// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateSubmission, useSubmitProof } from "@/hooks/useSubmissions";
import { useMyMetricsSubmissions, useSubmitMetricsSubmission } from "@/hooks/useMetrics";
import { usePaymentInfo } from "@/hooks/usePayments";
import { useUploadFile } from "@/hooks/useStorage";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Users, Star, CircleDollarSign, UserRoundCheck, Send, Upload, BarChart3, CheckCircle2 } from "lucide-react";

const CATEGORY_NAMES = {
  campanha: "Campanha",
  resposta_rapida: "Resposta Rápida",
  oficina: "Oficina",
  folhetim: "Folhetim",
  compartilhar_ecoante: "Compartilhar Ecoante",
  sidequest_teste: "Sidequest Teste",
};

// Validar tamanho máximo de arquivo (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const validateFileSize = (file, fieldName = 'arquivo') => {
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (MAX_FILE_SIZE / (1024 * 1024)).toFixed(0);
    throw new Error(`${fieldName} muito grande. Máximo permitido: ${sizeMB}MB. Seu arquivo: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
  }
};

const formatTimeLeft = (expiresAt) => {
  if (!expiresAt) return null;
  const now = new Date();
  const end = new Date(expiresAt);
  const diffMs = end.getTime() - now.getTime();

  if (diffMs <= 0) return "Expirada";

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
};

const STATUS_TEXT = {
  application_pending: 'Inscrição em análise',
  application_approved: 'Inscrição aprovada',
  application_rejected: 'Inscrição rejeitada',
  proof_pending: 'Prova em análise',
  approved: 'Tarefa concluída',
  rejected: 'Prova rejeitada',
  pending: 'Inscrição em análise',
}

const SIDEQUEST_PENDING_TEXT = 'Inscrito'

const PROOF_TYPE_LABELS = {
  link: 'Link',
  imagem: 'Imagem',
  image: 'Imagem',
  video: 'Vídeo',
  arquivo: 'Arquivo',
  file: 'Arquivo',
}

const getProofTypeLabel = (task) => {
  const raw = String(task?.proof_type || '').trim().toLowerCase()
  if (raw) return PROOF_TYPE_LABELS[raw] || task.proof_type

  if (Array.isArray(task?.content_formats) && task.content_formats.length > 0) {
    return task.content_formats.join(', ')
  }

  return 'Link e/ou arquivo'
}

const normalizeSubmissionStatus = (status) => {
  if (!status) return null;
  return String(status).trim().toLowerCase();
};

const isAutoExpiredSubmissionRejection = (submission) => {
  if (!submission) return false;

  const status = normalizeSubmissionStatus(submission.status);
  if (!['application_rejected', 'rejected'].includes(status)) return false;

  const reason = String(submission.rejection_reason || '').trim().toLowerCase();
  if (!reason) return false;

  return reason.includes('prazo de envio da prova expirou')
    || reason.includes('vaga cancelada por inatividade')
    || reason.includes('primeira tentativa de envio da prova');
};

const toDateOrNull = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const addBusinessDays = (baseDate, businessDays) => {
  if (!baseDate || businessDays <= 0) return baseDate ? new Date(baseDate) : null;

  const result = new Date(baseDate);
  let addedDays = 0;

  while (addedDays < businessDays) {
    result.setDate(result.getDate() + 1);
    const weekDay = result.getDay();
    const isBusinessDay = weekDay !== 0 && weekDay !== 6;
    if (isBusinessDay) addedDays += 1;
  }

  return result;
};

const isBusinessDay = (date) => {
  if (!date) return false;
  const weekDay = date.getDay();
  return weekDay !== 0 && weekDay !== 6;
};

const firstBusinessDayOnOrAfter = (baseDate) => {
  if (!baseDate) return null;
  const result = new Date(baseDate);

  while (!isBusinessDay(result)) {
    result.setDate(result.getDate() + 1);
  }

  return result;
};

const firstBusinessDayAfter = (baseDate) => {
  if (!baseDate) return null;
  const result = new Date(baseDate);
  result.setDate(result.getDate() + 1);

  while (!isBusinessDay(result)) {
    result.setDate(result.getDate() + 1);
  }

  return result;
};

const startOfDay = (date) => {
  if (!date) return null;
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const endOfDay = (date) => {
  if (!date) return null;
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

export default function TaskDetailsModal({ task, onClose, isTaskClaimed, isTaskApproved, currentSubmission }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [proofDescription, setProofDescription] = useState('');
  const [proofLink, setProofLink] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [metricsDescription, setMetricsDescription] = useState('');
  const [metricsLink, setMetricsLink] = useState('');
  const [metricsFile, setMetricsFile] = useState(null);
  const { user, profile } = useAuth();
  const createSubmission = useCreateSubmission();
  const submitProof = useSubmitProof();
  const submitMetrics = useSubmitMetricsSubmission();
  const uploadFile = useUploadFile();
  const { data: paymentInfo } = usePaymentInfo(user?.id);
  const { data: myMetricsSubmissions = [] } = useMyMetricsSubmissions(user?.id);

  if (!task) return null;

  const timeLeft = useMemo(() => formatTimeLeft(task.expires_at), [task.expires_at]);
  const displayCategory = CATEGORY_NAMES[task.category] || task.category;
  const displayProofType = useMemo(() => getProofTypeLabel(task), [task]);
  const offeredValue = Number(task.offered_value || task.points || 0);
  const userFollowers = Number(profile?.followers_count || 0);
  const minFollowersRequired = Number(task?.min_followers || 0);
  const meetsFollowersRequirement = userFollowers >= minFollowersRequired;
  const isFull = Boolean(task.max_participants) && Number(task.current_participants || 0) >= Number(task.max_participants);
  const submissionStatus = currentSubmission?.status;
  const submittedAt = currentSubmission?.created_at ? new Date(currentSubmission.created_at) : null;
  const hasValidSubmittedAt = submittedAt && !Number.isNaN(submittedAt.getTime());
  const proofDeadline = task?.category === 'campanha'
    ? (task?.posting_deadline ? new Date(task.posting_deadline) : null)
    : (task?.expires_at ? new Date(task.expires_at) : null);
  const isSidequestTask = task?.category === 'sidequest_teste';
  const hasProofDeadline = proofDeadline && !Number.isNaN(proofDeadline.getTime());
  const isProofDeadlineExpired = hasProofDeadline ? new Date() > proofDeadline : false;
  const isSubmissionExpiredByRule = isAutoExpiredSubmissionRejection(currentSubmission) && isProofDeadlineExpired;
  const isSubmissionReopenedByDateChange = isAutoExpiredSubmissionRejection(currentSubmission) && !isProofDeadlineExpired;
  const shouldShowSubmissionRejectionReason = Boolean(currentSubmission?.rejection_reason) && !isSubmissionReopenedByDateChange;
  const canApply = (!currentSubmission || isSubmissionReopenedByDateChange) && !isTaskApproved && !isFull && meetsFollowersRequirement;
  const canSubmitProof = (
    (submissionStatus === 'application_approved' || submissionStatus === 'rejected' || (isSidequestTask && submissionStatus === 'application_pending'))
    && !isProofDeadlineExpired
  );
  const isWaiting = ['application_pending', 'proof_pending', 'pending'].includes(submissionStatus);
  const isCampaignTask = task?.category === 'campanha';
  const currentMetricsSubmission = useMemo(
    () => myMetricsSubmissions.find((item) => String(item.task_id) === String(task.id)) || null,
    [myMetricsSubmissions, task.id]
  );
  const metricsStatus = currentMetricsSubmission?.status;
  const now = new Date();
  const metricsReviewedAt = currentMetricsSubmission?.reviewed_at
    ? new Date(currentMetricsSubmission.reviewed_at)
    : null;
  const hasMetricsReviewedAt = metricsReviewedAt && !Number.isNaN(metricsReviewedAt.getTime());
  const metricsResubmissionDeadline = hasMetricsReviewedAt
    ? new Date(metricsReviewedAt.getTime() + 2 * 24 * 60 * 60 * 1000)
    : null;
  const hasResubmissionWindowExpired = metricsStatus === 'rejected'
    && metricsResubmissionDeadline
    && now > metricsResubmissionDeadline;
  const canSubmitMetrics = isCampaignTask
    && submissionStatus === 'approved'
    && (!currentMetricsSubmission || (metricsStatus === 'rejected' && !hasResubmissionWindowExpired));
  const postingDeadline = task.posting_deadline ? new Date(task.posting_deadline) : null;
  const hasValidPostingDeadline = postingDeadline && !Number.isNaN(postingDeadline.getTime());
  const metricsBaseDate = postingDeadline || toDateOrNull(currentSubmission?.validated_at);
  const hasValidMetricsBaseDate = metricsBaseDate && !Number.isNaN(metricsBaseDate.getTime());
  const metricsWindowStartRaw = hasValidMetricsBaseDate
    ? firstBusinessDayAfter(metricsBaseDate)
    : null;
  const metricsWindowEndRaw = metricsWindowStartRaw
    ? addBusinessDays(metricsWindowStartRaw, 2)
    : null;
  const metricsWindowStart = startOfDay(metricsWindowStartRaw);
  const metricsWindowEnd = endOfDay(metricsWindowEndRaw);
  const metricsWindowLabel = metricsWindowStart && metricsWindowEnd
    ? `${metricsWindowStart.toLocaleDateString('pt-BR')} até ${metricsWindowEnd.toLocaleDateString('pt-BR')}`
    : null;
  const isInsideMetricsWindow =
    metricsWindowStart && metricsWindowEnd
      ? now >= metricsWindowStart && now <= metricsWindowEnd
      : true;
  const hasMetricsWindowPassed = metricsWindowEnd ? now > metricsWindowEnd : false;
  const shouldShowMetricsReminder = Boolean(
    isCampaignTask
    && submissionStatus === 'approved'
    && !currentMetricsSubmission
    && metricsWindowStart
    && now >= metricsWindowStart
    && !hasMetricsWindowPassed
  );

  const hasPassedStep1 = (isSidequestTask
    ? Boolean(currentSubmission)
    : ['application_approved', 'proof_pending', 'rejected', 'approved'].includes(submissionStatus)) && !canApply;
  const isStep2Current = ['application_approved', 'rejected', 'proof_pending'].includes(submissionStatus)
    || (isSidequestTask && submissionStatus === 'application_pending');
  const hasPassedStep2 = submissionStatus === 'approved';
  const isMetricsCompleted = metricsStatus === 'approved';
  const footerStageDeadline = useMemo(() => {
    if (isCampaignTask && hasPassedStep2 && metricsWindowEnd) {
      return {
        label: 'Expira em',
        date: metricsWindowEnd,
      };
    }

    if (hasProofDeadline) {
      return {
        label: 'Prazo da prova até',
        date: proofDeadline,
      };
    }

    if (task.expires_at) {
      return {
        label: timeLeft === 'Expirada' ? 'Expirada em' : 'Expira em',
        date: new Date(task.expires_at),
      };
    }

    return null;
  }, [isCampaignTask, hasPassedStep2, metricsWindowEnd, hasProofDeadline, proofDeadline, task.expires_at, timeLeft]);

  const submissionStageLabel = isSidequestTask && submissionStatus === 'application_pending'
    ? SIDEQUEST_PENDING_TEXT
    : STATUS_TEXT[submissionStatus] || 'Inscrição em análise';

  const metricsWindowHoverText = metricsWindowLabel
    ? `Só será possível enviar as métricas na janela: de ${metricsWindowLabel}.`
    : 'A janela de envio de métricas será disponibilizada conforme o prazo da tarefa.';

  const metricsSubmitHint = !metricsFile
    ? 'Anexe o arquivo de métricas para enviar.'
    : hasResubmissionWindowExpired
      ? 'Prazo de reenvio encerrado (2 dias após a rejeição).'
      : hasMetricsWindowPassed
        ? 'A janela de envio de métricas foi encerrada.'
        : !isInsideMetricsWindow
          ? (metricsWindowLabel
            ? `As métricas só serão possíveis de enviar na janela: ${metricsWindowLabel}.`
            : 'As métricas ainda não podem ser enviadas.')
          : '';

  const metricsInlineHint = !metricsFile
    ? 'Anexe o arquivo de métricas para liberar o envio.'
    : submissionStatus !== 'approved'
      ? 'A tarefa precisa estar aprovada para liberar o envio.'
      : metricsStatus === 'rejected' && hasResubmissionWindowExpired
        ? 'Prazo de reenvio encerrado.'
        : hasMetricsWindowPassed
          ? 'A janela de envio de métricas já foi encerrada.'
          : !isInsideMetricsWindow
            ? (metricsWindowLabel
              ? `Envio liberado apenas entre ${metricsWindowLabel}.`
              : 'A janela de envio de métricas ainda não começou.')
            : '';

    const metricsButtonTitle = [metricsWindowHoverText, metricsSubmitHint].filter(Boolean).join(' ');

  const handleApply = async (e) => {
    e.preventDefault();
    if (!canApply) return;

    setIsSubmitting(true);

    try {
      await createSubmission.mutateAsync({
        user_id: user.id,
        task_id: task.id,
        description: 'Candidatura enviada',
        proof_url: null,
      });

      alert('Candidatura enviada com sucesso! Aguarde a aprovação do administrador. ✅');
      onClose();
    } catch (error) {
      console.error('Erro ao candidatar-se:', error);
      alert(`Erro ao enviar candidatura.\n\nDetalhes: ${error?.message || 'Sem detalhes.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendProof = async (e) => {
    e.preventDefault();
    if (!canSubmitProof || !currentSubmission?.id) return;

    const trimmedProofLink = String(proofLink || '').trim();
    if (!trimmedProofLink && !proofFile) {
      alert('Envie pelo menos uma prova: link ou arquivo.');
      return;
    }

    if (proofFile) {
      try {
        validateFileSize(proofFile, 'Arquivo de prova');
      } catch (error) {
        alert(error.message);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      let uploadedFileUrl = null;
      if (proofFile) {
        const uploadResult = await uploadFile.mutateAsync({ file: proofFile, userId: user.id });
        uploadedFileUrl = uploadResult?.url || null;
      }

      const finalProofUrl = trimmedProofLink || uploadedFileUrl;
      const finalDescription = uploadedFileUrl && trimmedProofLink
        ? `${proofDescription || ''}\n\nArquivo complementar: ${uploadedFileUrl}`.trim()
        : proofDescription;

      await submitProof.mutateAsync({
        submissionId: currentSubmission.id,
        proofData: {
          description: finalDescription,
          proof_url: finalProofUrl,
        },
      });

      alert('Prova enviada com sucesso! Aguarde a aprovação final do administrador. ✅');
      onClose();
    } catch (error) {
      console.error('Erro ao enviar prova:', error);
      alert(`Erro ao enviar prova da tarefa.\n\nDetalhes: ${error?.message || 'Sem detalhes.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendMetrics = async (e) => {
    e.preventDefault();
    if (!canSubmitMetrics || !metricsFile) return;
    if (!isInsideMetricsWindow) {
      alert('As métricas só podem ser enviadas entre o 1º e o 3º dia útil após o fechamento da postagem.');
      return;
    }

    try {
      validateFileSize(metricsFile, 'Arquivo de métricas');
    } catch (error) {
      alert(error.message);
      return;
    }

    setIsSubmitting(true);

    try {
      const { url: metricsUrl } = await uploadFile.mutateAsync({ file: metricsFile, userId: user.id });

      await submitMetrics.mutateAsync({
        user,
        task,
        metricsFileUrl: metricsUrl,
        metricsLink,
        description: metricsDescription,
      });

      alert('Métricas enviadas com sucesso! Aguarde a análise do administrador.');
      setMetricsDescription('');
      setMetricsLink('');
      setMetricsFile(null);
      onClose();
    } catch (error) {
      console.error('Erro ao enviar métricas:', error);
      alert(`Erro ao enviar métricas.\n\nDetalhes: ${error?.message || 'Sem detalhes.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={!!task} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#3c0b14]">{task.title}</DialogTitle>
          <DialogDescription>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300 border text-xs">
                {displayCategory}
              </Badge>
              <Badge className="bg-orange-100 text-orange-700 border-orange-300 border text-xs">
                {task.campaign_type === 'resposta_rapida' ? 'Resposta Rápida' : 'Comum'}
              </Badge>
              {task.requires_application && !isSidequestTask && (
                <Badge className="bg-purple-100 text-purple-700 border-purple-300 border text-xs">
                  Requer Inscrição e Seleção
                </Badge>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
              <p className="text-xs text-gray-500 mb-1">Pagamento</p>
              <div className="flex items-center gap-2">
                <CircleDollarSign className="w-4 h-4 text-amber-600" />
                <p className="text-xl font-bold text-amber-600">R$ {offeredValue.toLocaleString('pt-BR')}</p>
              </div>
            </div>

            <div className="rounded-xl bg-blue-50 border border-blue-100 p-3">
              <p className="text-xs text-gray-500 mb-1">Vagas</p>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <p className="text-xl font-bold text-blue-600">
                  {task.current_participants || 0}{task.max_participants ? ` / ${task.max_participants}` : ''}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-fuchsia-200 p-3 space-y-1.5">
            <h3 className="font-semibold text-[#3c0b14] inline-flex items-center gap-2">
              <UserRoundCheck className="w-4 h-4 text-fuchsia-600" />
              Perfil Desejado
            </h3>
            <p className="text-xs text-gray-700">Experiência com sustentabilidade</p>
            <ul className="text-xs text-gray-500 list-disc pl-5 space-y-0.5">
              <li>Mínimo de {task.min_followers || 0} seguidores</li>
              <li>Tipo de prova: {displayProofType}</li>
              {Array.isArray(task.content_formats) && task.content_formats.length > 0 && (
                <li>Conteúdo: {task.content_formats.join(', ')}</li>
              )}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-1 text-[#3c0b14]">Descrição</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{task.description}</p>
            {hasValidSubmittedAt && (
              <p className="text-xs text-gray-500 mt-2">
                Submissão enviada em: {submittedAt.toLocaleDateString('pt-BR')} às {submittedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            {task.posting_deadline && (
              <p className="text-xs text-gray-500 mt-2">
                Data limite de postagem: {new Date(task.posting_deadline).toLocaleDateString('pt-BR')} {new Date(task.posting_deadline).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>

          <div className="pt-3 border-t space-y-3">
          {hasPassedStep1 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
              <p className="font-semibold text-emerald-700 inline-flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {isSidequestTask ? 'Sidequest iniciada: prova enviada ou em andamento' : 'Etapa 1 concluída: candidatura aprovada'}
              </p>
            </div>
          ) : submissionStatus !== 'approved' && (
            <div className="rounded-xl border border-fuchsia-300 p-3">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-full bg-fuchsia-500 text-white flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <div>
                  <p className="font-bold text-[#3c0b14]">Etapa 1: Candidatar-se</p>
                  <p className="text-xs text-gray-500">
                    {isSidequestTask
                      ? 'Ao se candidatar, você já fica inscrito para enviar a prova.'
                      : 'Envie sua candidatura para análise'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleApply}>
                {!meetsFollowersRequirement && minFollowersRequired > 0 && (
                  <div className="mb-3 text-xs rounded-lg p-3 border bg-red-50 border-red-200 text-red-800">
                    Esta tarefa exige no minimo {minFollowersRequired} seguidores para inscricao. Voce possui {userFollowers}.
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={isSubmitting || !canApply}
                  className="w-full bg-fuchsia-600 hover:bg-fuchsia-700"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {isTaskApproved || submissionStatus === 'approved'
                    ? 'Tarefa já concluída'
                    : isSubmissionReopenedByDateChange
                      ? 'Candidatar-se para esta Vaga'
                    : canSubmitProof
                      ? isSidequestTask && submissionStatus === 'application_pending'
                        ? 'Enviar prova da Sidequest'
                        : submissionStatus === 'rejected'
                        ? 'Prova rejeitada - reenviar abaixo'
                        : 'Inscrição aprovada - envie a prova abaixo'
                      : isWaiting
                        ? (isSidequestTask && submissionStatus === 'application_pending'
                          ? `${SIDEQUEST_PENDING_TEXT} - envie a prova abaixo`
                          : submissionStageLabel)
                        : isSubmissionExpiredByRule
                          ? 'Prazo expirado'
                        : submissionStatus === 'application_rejected'
                          ? 'Inscrição rejeitada'
                          : submissionStatus === 'rejected'
                            ? 'Prova rejeitada'
                      : isFull
                        ? 'Vagas encerradas'
                        : !meetsFollowersRequirement && minFollowersRequired > 0
                          ? `Minimo de ${minFollowersRequired} seguidores`
                        : isSubmitting
                          ? 'Enviando candidatura...'
                          : 'Candidatar-se para esta Vaga'}
                </Button>
              </form>
            </div>
          )}

          {hasPassedStep2 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
              <p className="font-semibold text-emerald-700 inline-flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Etapa 2 concluída: prova aprovada
              </p>
            </div>
          ) : isStep2Current ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 space-y-3">
              <p className="font-semibold text-emerald-700">Etapa 2: Enviar prova de conclusão</p>
              {hasProofDeadline && (
                <p className="text-xs text-emerald-800">
                  Prazo para envio da prova: até {proofDeadline.toLocaleDateString('pt-BR')} às {proofDeadline.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.
                </p>
              )}
              {submissionStatus === 'proof_pending' ? (
                <div className="text-xs rounded-lg p-3 border bg-blue-50 border-blue-200 text-blue-800">
                  Prova enviada com sucesso. Aguarde a validação final do administrador.
                </div>
              ) : (
              <form onSubmit={handleSendProof} className="space-y-3">
                <div>
                  <Label htmlFor="proof-description">Descrição da prova (opcional)</Label>
                  <Textarea
                    id="proof-description"
                    value={proofDescription}
                    onChange={(e) => setProofDescription(e.target.value)}
                    placeholder="Explique como você concluiu a tarefa..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="proof-link">Link da prova (opcional)</Label>
                  <Input
                    id="proof-link"
                    type="url"
                    value={proofLink}
                    onChange={(e) => setProofLink(e.target.value)}
                    placeholder="Cole o link da prova (ex.: Instagram, Drive, YouTube)"
                  />
                  {String(proofLink || '').trim() && (
                    <p className="text-xs text-amber-700 mt-1">
                      Se for link do Drive, confirme se o arquivo/pasta está com acesso liberado para visualização.
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="proof-file">Arquivo da prova (opcional)</Label>
                  <input
                    id="proof-file"
                    type="file"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-emerald-100 file:text-emerald-700 hover:file:bg-emerald-200"
                  />
                  <p className="text-xs text-gray-500 mt-1">Máximo: 5MB</p>
                </div>
                <p className="text-xs text-gray-600 rounded-md bg-emerald-50 border border-emerald-100 px-2.5 py-2">
                  Envie a prova com link e/ou arquivo. Você pode mandar apenas um deles ou os dois juntos.
                </p>

                <Button
                  type="submit"
                  disabled={isSubmitting || uploadFile.isPending || submitProof.isPending}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {isSubmitting || uploadFile.isPending || submitProof.isPending
                    ? 'Enviando prova...'
                    : submissionStatus === 'rejected'
                      ? 'Reenviar prova para nova análise'
                      : 'Enviar prova para aprovação final'}
                </Button>
              </form>
              )}
            </div>
          ) : null}

          {isCampaignTask && hasPassedStep2 && (
            isMetricsCompleted ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
                <p className="font-semibold text-emerald-700 inline-flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Etapa 3 concluída: métricas aprovadas
                </p>
              </div>
            ) : (
            <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3 space-y-3">
              <p className="font-semibold text-sky-700 inline-flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Etapa 3: Postar e enviar métricas
              </p>
              <p className="text-xs text-gray-600">
                Você está autorizado a postar. Lembre-se de enviar um arquivo com comprovação da data da postagem.
              </p>

              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-semibold text-emerald-800 mb-2">Checklist para receber o pagamento</p>
                <ul className="text-xs text-emerald-900 list-disc pl-5 space-y-1">
                  <li>
                    Publique no dia e horário combinados
                    {hasValidPostingDeadline
                      ? ` (até ${postingDeadline.toLocaleDateString('pt-BR')} às ${postingDeadline.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`
                      : ''}
                    .
                  </li>
                  <li>Use as hashtags e requisitos definidos na campanha.</li>
                  <li>Envie as métricas com comprovante dentro da janela informada abaixo.</li>
                  <li>Mantenha seus dados bancários atualizados para pagamento manual fora da plataforma.</li>
                </ul>
              </div>

              {metricsWindowStart && metricsWindowEnd && (
                <div className="text-xs rounded-lg p-3 border bg-amber-50 border-amber-200 text-amber-800">
                  Janela de envio de métricas: de {metricsWindowStart.toLocaleDateString('pt-BR')} até {metricsWindowEnd.toLocaleDateString('pt-BR')}.
                </div>
              )}

              {metricsStatus === 'rejected' && metricsResubmissionDeadline && (
                <div className={`text-xs rounded-lg p-3 border ${hasResubmissionWindowExpired ? 'bg-red-50 border-red-200 text-red-800' : 'bg-orange-50 border-orange-200 text-orange-800'}`}>
                  Reenvio após rejeição: até {metricsResubmissionDeadline.toLocaleDateString('pt-BR')} às {metricsResubmissionDeadline.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.
                </div>
              )}

              {shouldShowMetricsReminder && (
                <div className="text-xs rounded-lg p-3 border bg-emerald-50 border-emerald-200 text-emerald-800">
                  Hora de começar a organizar as métricas. Confira abaixo os itens obrigatórios para evitar retrabalho.
                </div>
              )}

              {!isInsideMetricsWindow && !hasMetricsWindowPassed && (
                <div className="text-xs rounded-lg p-3 border bg-blue-50 border-blue-200 text-blue-800">
                  O envio ainda não está disponível. Aguarde o 1º dia útil após o fechamento da postagem.
                </div>
              )}

              {hasMetricsWindowPassed && (
                <div className="text-xs rounded-lg p-3 border bg-red-50 border-red-200 text-red-800">
                  A janela para envio de métricas foi encerrada (após o 3º dia útil do fechamento da postagem).
                </div>
              )}

              {hasResubmissionWindowExpired && (
                <div className="text-xs rounded-lg p-3 border bg-red-50 border-red-200 text-red-800">
                  Prazo de reenvio encerrado (2 dias após rejeição). Fluxo concluído sem pontos e sem pagamento.
                </div>
              )}

              {!currentMetricsSubmission || metricsStatus === 'rejected' ? (
                <form onSubmit={handleSendMetrics} className="space-y-3">
                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
                    <p className="text-xs font-semibold text-sky-800 mb-2">Checklist obrigatório no print/arquivo de métricas</p>
                    <ul className="text-xs text-sky-700 list-disc pl-4 space-y-1">
                      <li>Data da postagem visível (principal para validação de prazo).</li>
                      <li>Alcance e impressões do conteúdo.</li>
                      <li>Interações (curtidas, comentários, compartilhamentos/salvamentos).</li>
                    </ul>
                  </div>

                  <div>
                    <Label htmlFor="metrics-link">Link do post (opcional)</Label>
                    <Input
                      id="metrics-link"
                      type="url"
                      value={metricsLink}
                      onChange={(e) => setMetricsLink(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>

                  <div>
                    <Label htmlFor="metrics-description">Descrição das métricas (opcional)</Label>
                    <Textarea
                      id="metrics-description"
                      value={metricsDescription}
                      onChange={(e) => setMetricsDescription(e.target.value)}
                      placeholder="Explique os dados enviados..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="metrics-file">Arquivo de métricas</Label>
                    <input
                      id="metrics-file"
                      type="file"
                      onChange={(e) => setMetricsFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-emerald-100 file:text-emerald-700 hover:file:bg-emerald-200"
                    />
                    <p className="text-xs text-gray-500 mt-1">Máximo: 5MB</p>
                  </div>

                  <div title={metricsButtonTitle || undefined}>
                    <Button
                      type="submit"
                      disabled={isSubmitting || uploadFile.isPending || submitMetrics.isPending || !metricsFile || !isInsideMetricsWindow || hasResubmissionWindowExpired}
                      className="w-full bg-sky-600 hover:bg-sky-700"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {isSubmitting || uploadFile.isPending || submitMetrics.isPending
                        ? 'Enviando métricas...'
                        : currentMetricsSubmission?.status === 'rejected'
                          ? 'Reenviar métricas'
                          : 'Enviar métricas para aprovação'}
                    </Button>
                  </div>

                  {metricsInlineHint && (
                    <p className="text-[11px] text-gray-500 leading-snug">
                      {metricsInlineHint}
                    </p>
                  )}
                </form>
              ) : (
                <div className="space-y-2">
                  {metricsStatus === 'pending' && (
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                      Métricas em análise
                    </Badge>
                  )}
                  {metricsStatus === 'approved' && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                      Métricas aprovadas - pagamento a caminho
                    </Badge>
                  )}
                </div>
              )}

              {currentMetricsSubmission?.status === 'rejected' && currentMetricsSubmission?.rejection_reason && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                  <p className="text-xs font-semibold text-red-700 mb-1">Motivo da rejeição das métricas</p>
                  <p className="text-sm text-red-600">{currentMetricsSubmission.rejection_reason}</p>
                </div>
              )}
            </div>
            )
          )}
          </div>

          {shouldShowSubmissionRejectionReason && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-xs font-semibold text-red-700 mb-1">Motivo da rejeição</p>
              <p className="text-sm text-red-600">{currentSubmission.rejection_reason}</p>
            </div>
          )}

          {footerStageDeadline?.date && (
            <div className="flex items-center justify-end text-xs text-gray-500 gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {footerStageDeadline.label} <strong>{footerStageDeadline.date.toLocaleString('pt-BR')}</strong>
              </span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
