// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateSubmission, useSubmitProof } from "@/hooks/useSubmissions";
import { useMyMetricsSubmissions, useSubmitMetricsSubmission } from "@/hooks/useMetrics";
import { usePaymentInfo } from "@/hooks/usePayments";
import { useUploadFile } from "@/hooks/useStorage";
import { getProofApprovalMetricsWindow, getMetricsResubmissionDeadline } from '@/lib/metrics-window';
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
import { notifyError, notifySuccess, notifyWarning } from "@/lib/toast";
import { C, heading, body } from '@/lib/theme';

const CATEGORY_NAMES = {
  campanha: "Campanha",
  resposta_rapida: "Resposta Rápida",
  oficina: "Oficina",
  folhetim: "Folhetim",
  compartilhar_ecoante: "Compartilhar Ecoante",
  sidequest_teste: "Sidequest",
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
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [proofDescription, setProofDescription] = useState('');
  const [proofLink, setProofLink] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [metricsDescription, setMetricsDescription] = useState('');
  const [metricsLink, setMetricsLink] = useState('');
  const [metricsFiles, setMetricsFiles] = useState([]);
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
  const metricsResubmissionDeadline = getMetricsResubmissionDeadline(currentMetricsSubmission?.reviewed_at);
  const hasResubmissionWindowExpired = metricsStatus === 'rejected'
    && metricsResubmissionDeadline
    && now > metricsResubmissionDeadline;
  const canSubmitMetrics = isCampaignTask
    && submissionStatus === 'approved'
    && (!currentMetricsSubmission || (metricsStatus === 'rejected' && !hasResubmissionWindowExpired));
  const proofApprovalMetricsWindow = getProofApprovalMetricsWindow(currentSubmission?.validated_at);
  const metricsWindowStart = proofApprovalMetricsWindow.start;
  const metricsWindowEnd = proofApprovalMetricsWindow.end;
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
    : 'A janela de envio de métricas será disponibilizada 24 horas após a aprovação da prova.';

  const metricsSubmitHint = (!metricsFiles || metricsFiles.length === 0)
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

  const metricsInlineHint = (!metricsFiles || metricsFiles.length === 0)
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

    // Validação adicional de limite de vagas
    if (isFull) {
      notifyError('❌ Esta tarefa já atingiu o limite de participantes. Não há mais vagas disponíveis.');
      return;
    }

    setIsSubmitting(true);

    try {
      await createSubmission.mutateAsync({
        user_id: user.id,
        task_id: task.id,
        description: 'Candidatura enviada',
        proof_url: null,
      });

      notifySuccess('Candidatura enviada com sucesso! Aguarde a aprovação do administrador. ✅');
      onClose();
    } catch (error) {
      console.error('Erro ao candidatar-se:', error);
      notifyError(error?.message || 'Erro ao enviar candidatura.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendProof = async (e) => {
    e.preventDefault();
    if (!canSubmitProof || !currentSubmission?.id) return;

    const trimmedProofLink = String(proofLink || '').trim();
    if (!trimmedProofLink && !proofFile) {
      notifyWarning('Envie pelo menos uma prova: link ou arquivo.');
      return;
    }

    if (proofFile) {
      try {
        validateFileSize(proofFile, 'Arquivo de prova');
      } catch (error) {
        notifyWarning(error.message);
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

      notifySuccess('Prova enviada com sucesso! Aguarde a aprovação final do administrador. ✅');
      onClose();
    } catch (error) {
      console.error('Erro ao enviar prova:', error);
      notifyError(error?.message || 'Erro ao enviar prova da tarefa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendMetrics = async (e) => {
    e.preventDefault();
    if (!canSubmitMetrics || !metricsFiles || metricsFiles.length === 0) return;
    if (!isInsideMetricsWindow) {
      notifyWarning('As métricas só podem ser enviadas a partir de 24 horas após a aprovação da prova e por até 2 dias úteis após esse momento.');
      return;
    }

    try {
      for (const f of metricsFiles) validateFileSize(f, 'Arquivo de métricas');
    } catch (error) {
      notifyWarning(error.message);
      return;
    }

    setIsSubmitting(true);

    try {
      const uploaded = [];
      for (const f of metricsFiles) {
        const { url } = await uploadFile.mutateAsync({ file: f, userId: user.id });
        uploaded.push(url);
      }

      await submitMetrics.mutateAsync({
        user,
        task,
        metricsFileUrls: uploaded,
        metricsLink,
        description: metricsDescription,
      });

      notifySuccess('Métricas enviadas com sucesso! Aguarde a análise do administrador.');
      setMetricsDescription('');
      setMetricsLink('');
      setMetricsFiles([]);
      onClose();
    } catch (error) {
      console.error('Erro ao enviar métricas:', error);
      notifyError(error?.message || 'Erro ao enviar métricas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={!!task} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto sm:rounded-3xl !bg-[#161616] !border-white/10" style={{ color: C.cream }}>
        <DialogHeader>
          <DialogTitle style={{ ...heading, fontSize: 24, fontWeight: 800, color: C.cream }}>{task.title}</DialogTitle>
          <DialogDescription>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: 'rgba(255,255,222,0.06)', color: C.cream, ...heading }}>
                {displayCategory}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: `${C.orange}18`, color: C.orange, ...heading }}>
                {task.campaign_type === 'resposta_rapida' ? 'Resposta Rápida' : 'Comum'}
              </span>
              {task.requires_application && !isSidequestTask && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: `${C.blue}18`, color: '#7799FF', ...heading }}>
                  Requer Inscrição e Seleção
                </span>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className={`grid grid-cols-1 ${task.max_participants ? 'md:grid-cols-2' : ''} gap-3`}>
            <div className="rounded-2xl p-4" style={{ backgroundColor: 'rgba(255,255,222,0.03)', border: '1px solid rgba(255,255,222,0.06)' }}>
              <p className="text-xs mb-1" style={{ color: `${C.cream}60` }}>Pagamento / Pontuação</p>
              <div className="flex items-center gap-2">
                <CircleDollarSign className="w-4 h-4" style={{ color: C.lime }} />
                <p className="text-xl font-bold" style={{ color: C.lime, ...heading }}>{isCampaignTask ? `R$ ${offeredValue.toLocaleString('pt-BR')}` : `${offeredValue.toLocaleString('pt-BR')} pts`}</p>
              </div>
            </div>

            {task.max_participants && (
              <div className="rounded-2xl p-4" style={{ backgroundColor: 'rgba(255,255,222,0.03)', border: '1px solid rgba(255,255,222,0.06)' }}>
                <p className="text-xs mb-1" style={{ color: `${C.cream}60` }}>Vagas Preenchidas</p>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" style={{ color: C.blue }} />
                  <p className="text-xl font-bold" style={{ color: C.blue, ...heading }}>
                    {task.current_participants || 0} / {task.max_participants}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl p-4 space-y-1.5" style={{ backgroundColor: 'rgba(255,255,222,0.03)', border: '1px solid rgba(255,255,222,0.06)' }}>
            <h3 className="inline-flex items-center gap-2" style={{ ...heading, fontSize: 14, fontWeight: 700, color: C.cream }}>
              <UserRoundCheck className="w-4 h-4" style={{ color: C.blue }} />
              Perfil Desejado
            </h3>
            {task.profile_requirements && <p className="text-xs" style={{ color: `${C.cream}80` }}>{task.profile_requirements}</p>}
            <ul className="text-xs list-disc pl-5 space-y-0.5 mt-2" style={{ color: `${C.cream}60` }}>
              <li>Mínimo de {task.min_followers || 0} seguidores</li>
              <li>Formato de entrega: {displayProofType}</li>
              {Array.isArray(task.content_formats) && task.content_formats.length > 0 && (
                <li>Conteúdos esperados: {task.content_formats.join(', ')}</li>
              )}
            </ul>
          </div>

          <div className="min-w-0">
            <h3 className="mb-2" style={{ ...heading, fontSize: 14, fontWeight: 700, color: C.cream }}>Descrição da Tarefa</h3>
            {task.description ? (
              (() => {
                const shouldShowToggle = String(task.description || '').length > 240 || String(task.description || '').includes('\n\n');
                if (showFullDescription) {
                  return (
                    <>
                      <p className="text-sm whitespace-pre-wrap break-words break-all" style={{ color: `${C.cream}80`, lineHeight: 1.6 }}>{task.description}</p>
                      {shouldShowToggle && (
                        <button
                          type="button"
                          onClick={() => setShowFullDescription(false)}
                          className="text-xs hover:underline mt-2 block"
                          style={{ color: C.lime }}
                        >
                          Ver menos
                        </button>
                      )}
                    </>
                  );
                }

                return (
                  <>
                    <p className="text-sm line-clamp-3 break-words break-all whitespace-pre-wrap" style={{ color: `${C.cream}80`, lineHeight: 1.6 }}>{task.description}</p>
                    {shouldShowToggle && (
                      <button
                        type="button"
                        onClick={() => setShowFullDescription(true)}
                        className="text-xs hover:underline mt-2 block"
                        style={{ color: C.lime }}
                      >
                        Ver mais
                      </button>
                    )}
                  </>
                );
              })()
            ) : (
              <p className="text-sm" style={{ color: `${C.cream}60` }}>-</p>
            )}
            {hasValidSubmittedAt && (
              <p className="text-xs mt-3" style={{ color: `${C.cream}40` }}>
                Submissão enviada em: {submittedAt.toLocaleDateString('pt-BR')} às {submittedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            )}
            {task.posting_deadline && (
              <p className="text-xs mt-1" style={{ color: `${C.cream}40` }}>
                Data limite de postagem: {new Date(task.posting_deadline).toLocaleDateString('pt-BR')} {new Date(task.posting_deadline).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            )}
          </div>

          <div className="pt-5 mt-5 space-y-4" style={{ borderTop: '1px solid rgba(255,255,222,0.06)' }}>
          {hasPassedStep1 ? (
            <div className="rounded-xl p-3" style={{ backgroundColor: 'rgba(204,255,68,0.08)', border: '1px solid rgba(204,255,68,0.2)' }}>
              <p className="font-semibold inline-flex items-center gap-2" style={{ color: C.lime, fontSize: 13 }}>
                <CheckCircle2 className="w-4 h-4" />
                {isSidequestTask ? 'Sidequest iniciada: prova enviada ou em andamento' : 'Etapa 1 concluída: candidatura aprovada'}
              </p>
            </div>
          ) : submissionStatus !== 'approved' && (
            <div className="rounded-2xl p-5" style={{ backgroundColor: 'rgba(255,255,222,0.02)', border: '1px solid rgba(255,255,222,0.06)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{ backgroundColor: `${C.blue}20`, color: '#7799FF', ...heading }}>
                  1
                </div>
                <div>
                  <p style={{ ...heading, fontSize: 15, fontWeight: 700, color: C.cream }}>Etapa 1: Candidatar-se</p>
                  <p className="text-xs" style={{ color: `${C.cream}50` }}>
                    {isSidequestTask
                      ? 'Ao se candidatar, você já fica inscrito para enviar a prova.'
                      : 'Envie sua candidatura para análise'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleApply}>
                {!meetsFollowersRequirement && minFollowersRequired > 0 && (
                  <div className="mb-3 text-xs rounded-xl p-3" style={{ backgroundColor: 'rgba(255,34,85,0.12)', color: '#FF2255', border: '1px solid rgba(255,34,85,0.2)' }}>
                    Esta tarefa exige no mínimo {minFollowersRequired} seguidores. Você possui {userFollowers}.
                  </div>
                )}
                {isFull && (
                  <div className="mb-3 text-xs rounded-xl p-3" style={{ backgroundColor: 'rgba(255,34,85,0.12)', color: '#FF2255', border: '1px solid rgba(255,34,85,0.2)' }}>
                    ❌ Esta tarefa já atingiu o limite de {task.max_participants} participantes. Não há mais vagas disponíveis.
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting || !canApply}
                  className="w-full flex justify-center items-center h-[46px] rounded-xl transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                  style={{ backgroundColor: C.blue, color: C.cream, ...heading, fontSize: 14, fontWeight: 700 }}
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
                </button>
              </form>
            </div>
          )}

          {hasPassedStep2 ? (
            <div className="rounded-xl p-3" style={{ backgroundColor: 'rgba(204,255,68,0.08)', border: '1px solid rgba(204,255,68,0.2)' }}>
              <p className="font-semibold inline-flex items-center gap-2" style={{ color: C.lime, fontSize: 13 }}>
                <CheckCircle2 className="w-4 h-4" />
                Etapa 2 concluída: prova aprovada
              </p>
            </div>
          ) : isStep2Current ? (
            <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: 'rgba(255,255,222,0.02)', border: '1px solid rgba(255,255,222,0.06)' }}>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{ backgroundColor: `${C.blue}20`, color: '#7799FF', ...heading }}>
                  2
                </div>
                <div>
                  <p style={{ ...heading, fontSize: 15, fontWeight: 700, color: C.cream }}>Etapa 2: Enviar prova</p>
                  {hasProofDeadline && (
                    <p className="text-xs" style={{ color: `${C.cream}50` }}>
                      Prazo: até {proofDeadline.toLocaleDateString('pt-BR')} às {proofDeadline.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.
                    </p>
                  )}
                </div>
              </div>

              {submissionStatus === 'proof_pending' ? (
                <div className="text-xs rounded-xl p-3" style={{ backgroundColor: 'rgba(68,102,255,0.12)', color: '#8899FF', border: '1px solid rgba(68,102,255,0.2)' }}>
                  Prova enviada com sucesso. Aguarde a validação final do administrador.
                </div>
              ) : (
              <form onSubmit={handleSendProof} className="space-y-4">
                <div>
                  <Label htmlFor="proof-description" style={{ color: `${C.cream}70` }}>Descrição da prova (opcional)</Label>
                  <Textarea
                    id="proof-description"
                    value={proofDescription}
                    onChange={(e) => setProofDescription(e.target.value)}
                    placeholder="Explique como você concluiu a tarefa..."
                    rows={3}
                    className="mt-1.5 !bg-black !border-white/10 text-white placeholder:text-white/30 rounded-xl resize-none focus-visible:ring-1 focus-visible:ring-white/20"
                  />
                </div>
                <div>
                  <Label htmlFor="proof-link" style={{ color: `${C.cream}70` }}>Link da prova</Label>
                  <Input
                    id="proof-link"
                    type="url"
                    value={proofLink}
                    onChange={(e) => setProofLink(e.target.value)}
                    placeholder="Cole o link da prova (ex.: Instagram, Drive, YouTube)"
                    className="mt-1.5 h-[46px] !bg-black !border-white/10 text-white placeholder:text-white/30 rounded-xl focus-visible:ring-1 focus-visible:ring-white/20"
                  />
                  {String(proofLink || '').trim() && (
                    <p className="text-xs mt-1.5" style={{ color: C.orange }}>
                      Se for link do Drive, confirme se o arquivo/pasta está com acesso liberado.
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="proof-file" style={{ color: `${C.cream}70` }}>Arquivo da prova</Label>
                  <input
                    id="proof-file"
                    type="file"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    className="block w-full mt-1.5 text-sm file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold transition-all file:bg-white/10 file:text-white hover:file:bg-white/20 file:cursor-pointer cursor-pointer text-white/50"
                  />
                  <p className="text-xs mt-1.5" style={{ color: `${C.cream}40` }}>Máximo: 5MB</p>
                </div>
                
                <p className="text-xs rounded-xl px-3 py-2.5" style={{ backgroundColor: 'rgba(255,255,222,0.03)', border: '1px solid rgba(255,255,222,0.06)', color: `${C.cream}60` }}>
                  Envie a prova utilizando link, arquivo, ou os dois.
                </p>

                <button
                  type="submit"
                  disabled={isSubmitting || uploadFile.isPending || submitProof.isPending}
                  className="w-full flex justify-center items-center h-[46px] rounded-xl transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                  style={{ backgroundColor: C.lime, color: C.black, ...heading, fontSize: 14, fontWeight: 700 }}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {isSubmitting || uploadFile.isPending || submitProof.isPending
                    ? 'Enviando prova...'
                    : submissionStatus === 'rejected'
                      ? 'Reenviar prova para nova análise'
                      : 'Enviar prova para aprovação final'}
                </button>
              </form>
              )}
            </div>
          ) : null}

          {isCampaignTask && hasPassedStep2 && (
            isMetricsCompleted ? (
              <div className="rounded-xl p-3" style={{ backgroundColor: 'rgba(204,255,68,0.08)', border: '1px solid rgba(204,255,68,0.2)' }}>
                <p className="font-semibold inline-flex items-center gap-2" style={{ color: C.lime, fontSize: 13 }}>
                  <CheckCircle2 className="w-4 h-4" />
                  Etapa 3 concluída: métricas aprovadas
                </p>
              </div>
            ) : (
            <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: 'rgba(255,255,222,0.02)', border: '1px solid rgba(255,255,222,0.06)' }}>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{ backgroundColor: `${C.orange}20`, color: C.orange, ...heading }}>
                  3
                </div>
                <div>
                  <p style={{ ...heading, fontSize: 15, fontWeight: 700, color: C.cream }}>Etapa 3: Postar e enviar métricas</p>
                  <p className="text-xs" style={{ color: `${C.cream}50` }}>
                    Você está autorizado a postar o conteúdo aprovado.
                  </p>
                </div>
              </div>

              <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(255,255,222,0.03)', border: '1px solid rgba(255,255,222,0.06)' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: C.cream }}>Checklist para receber o pagamento</p>
                <ul className="text-xs list-disc pl-5 space-y-1.5" style={{ color: `${C.cream}70` }}>
                  <li>
                    Publique no dia e horário combinados
                    {hasProofDeadline
                      ? ` (até ${proofDeadline.toLocaleDateString('pt-BR')} às ${proofDeadline.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })})`
                      : ''}
                    .
                  </li>
                  <li>Use as hashtags e requisitos definidos na campanha.</li>
                  <li>Envie as métricas com comprovante dentro da janela informada abaixo.</li>
                  <li>Mantenha seus dados bancários atualizados no menu "Meus Pagamentos".</li>
                </ul>
              </div>

              {metricsStatus === 'rejected' && metricsResubmissionDeadline && (
                <div className="text-xs rounded-xl p-3" style={{ backgroundColor: hasResubmissionWindowExpired ? 'rgba(255,34,85,0.12)' : 'rgba(255,136,51,0.12)', color: hasResubmissionWindowExpired ? '#FF2255' : C.orange, border: `1px solid ${hasResubmissionWindowExpired ? 'rgba(255,34,85,0.2)' : 'rgba(255,136,51,0.2)'}` }}>
                  Reenvio após rejeição: até {metricsResubmissionDeadline.toLocaleDateString('pt-BR')} às {metricsResubmissionDeadline.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.
                </div>
              )}

              {shouldShowMetricsReminder && (
                <div className="text-xs rounded-xl p-3" style={{ backgroundColor: 'rgba(204,255,68,0.12)', color: C.lime, border: '1px solid rgba(204,255,68,0.2)' }}>
                  A janela de envio está aberta. Separe prints do alcance, impressões e interações.
                </div>
              )}

              {!isInsideMetricsWindow && !hasMetricsWindowPassed && (
                <div className="text-xs rounded-xl p-3" style={{ backgroundColor: 'rgba(68,102,255,0.12)', color: '#8899FF', border: '1px solid rgba(68,102,255,0.2)' }}>
                  O envio das métricas abrirá apenas 24 horas após a aprovação da sua prova.
                </div>
              )}

              {hasMetricsWindowPassed && (
                <div className="text-xs rounded-xl p-3" style={{ backgroundColor: 'rgba(255,34,85,0.12)', color: '#FF2255', border: '1px solid rgba(255,34,85,0.2)' }}>
                  A janela para envio de métricas foi encerrada (2 dias úteis após 24 horas da aprovação da prova).
                </div>
              )}

              {hasResubmissionWindowExpired && (
                <div className="text-xs rounded-xl p-3" style={{ backgroundColor: 'rgba(255,34,85,0.12)', color: '#FF2255', border: '1px solid rgba(255,34,85,0.2)' }}>
                  Prazo de reenvio encerrado (2 dias após rejeição). Fluxo concluído sem pontos e sem pagamento.
                </div>
              )}

              {!currentMetricsSubmission || metricsStatus === 'rejected' ? (
                <form onSubmit={handleSendMetrics} className="space-y-4">
                  <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(255,255,222,0.03)', border: '1px solid rgba(255,255,222,0.06)' }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: C.cream }}>Checklist obrigatório no arquivo</p>
                    <ul className="text-xs list-disc pl-4 space-y-1.5" style={{ color: `${C.cream}70` }}>
                      <li>Data da postagem visível (principal para validação de prazo).</li>
                      <li>Alcance e impressões do conteúdo.</li>
                      <li>Interações (curtidas, comentários, compartilhamentos/salvamentos).</li>
                    </ul>
                  </div>

                  <div>
                    <Label htmlFor="metrics-link" style={{ color: `${C.cream}70` }}>Link do post (Opcional)</Label>
                    <Input
                      id="metrics-link"
                      type="url"
                      value={metricsLink}
                      onChange={(e) => setMetricsLink(e.target.value)}
                      placeholder="https://..."
                      className="mt-1.5 h-[46px] !bg-black !border-white/10 text-white placeholder:text-white/30 rounded-xl focus-visible:ring-1 focus-visible:ring-white/20"
                    />
                  </div>

                  <div>
                    <Label htmlFor="metrics-description" style={{ color: `${C.cream}70` }}>Descrição das métricas (opcional)</Label>
                    <Textarea
                      id="metrics-description"
                      value={metricsDescription}
                      onChange={(e) => setMetricsDescription(e.target.value)}
                      placeholder="Explique os dados enviados..."
                      rows={3}
                      className="mt-1.5 !bg-black !border-white/10 text-white placeholder:text-white/30 rounded-xl resize-none focus-visible:ring-1 focus-visible:ring-white/20"
                    />
                  </div>

                  <div>
                    <Label htmlFor="metrics-file" style={{ color: `${C.cream}70` }}>Arquivo de métricas (Obrigatório)</Label>
                    <input
                      id="metrics-file"
                      type="file"
                      multiple
                      onChange={(e) => setMetricsFiles(Array.from(e.target.files || []))}
                      className="block w-full mt-1.5 text-sm file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold transition-all file:bg-white/10 file:text-white hover:file:bg-white/20 file:cursor-pointer cursor-pointer text-white/50"
                    />
                    <p className="text-xs mt-1.5" style={{ color: `${C.cream}40` }}>Máximo: 5MB por arquivo. Inclua prints da data, alcance e impressões.</p>
                  </div>

                  {metricsWindowStart && metricsWindowEnd && (
                    <div className="text-xs rounded-xl p-3" style={{ backgroundColor: 'rgba(255,255,222,0.03)', border: '1px solid rgba(255,255,222,0.06)', color: `${C.cream}60` }}>
                      Janela de envio: de {metricsWindowStart.toLocaleDateString('pt-BR')} até {metricsWindowEnd.toLocaleDateString('pt-BR')}.
                    </div>
                  )}

                  <div title={metricsButtonTitle || undefined}>
                    <button
                      type="submit"
                      disabled={isSubmitting || uploadFile.isPending || submitMetrics.isPending || !metricsFiles || metricsFiles.length === 0 || !isInsideMetricsWindow || hasResubmissionWindowExpired}
                      className="w-full flex justify-center items-center h-[46px] rounded-xl transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                      style={{ backgroundColor: C.orange, color: C.black, ...heading, fontSize: 14, fontWeight: 700 }}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {isSubmitting || uploadFile.isPending || submitMetrics.isPending
                        ? 'Enviando métricas...'
                        : currentMetricsSubmission?.status === 'rejected'
                          ? 'Reenviar métricas'
                          : 'Enviar métricas para aprovação'}
                    </button>
                  </div>

                  {metricsInlineHint && (
                    <p className="text-[11px] leading-snug" style={{ color: `${C.cream}40` }}>
                      {metricsInlineHint}
                    </p>
                  )}
                </form>
              ) : (
                <div className="space-y-2 mt-2">
                  {metricsStatus === 'pending' && (
                    <div className="text-xs rounded-xl p-3" style={{ backgroundColor: 'rgba(68,102,255,0.12)', color: '#8899FF', border: '1px solid rgba(68,102,255,0.2)' }}>
                      Métricas enviadas. Em análise.
                    </div>
                  )}
                  {metricsStatus === 'approved' && (
                    <div className="text-xs rounded-xl p-3" style={{ backgroundColor: 'rgba(204,255,68,0.12)', color: C.lime, border: '1px solid rgba(204,255,68,0.2)' }}>
                      Métricas aprovadas - pagamento a caminho
                    </div>
                  )}
                </div>
              )}

              {currentMetricsSubmission?.status === 'rejected' && currentMetricsSubmission?.rejection_reason && (
                <div className="rounded-xl p-3 mt-4" style={{ backgroundColor: 'rgba(255,34,85,0.12)', border: '1px solid rgba(255,34,85,0.2)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#FF2255' }}>Motivo da rejeição das métricas</p>
                  <p className="text-sm" style={{ color: '#FF2255' }}>{currentMetricsSubmission.rejection_reason}</p>
                </div>
              )}
            </div>
            )
          )}
          </div>

          {shouldShowSubmissionRejectionReason && (
            <div className="rounded-xl p-3 mt-4" style={{ backgroundColor: 'rgba(255,34,85,0.12)', border: '1px solid rgba(255,34,85,0.2)' }}>
              <p className="text-xs font-semibold mb-1" style={{ color: '#FF2255' }}>Motivo da rejeição</p>
              <p className="text-sm" style={{ color: '#FF2255' }}>{currentSubmission.rejection_reason}</p>
            </div>
          )}

          {footerStageDeadline?.date && (
            <div className="flex items-center justify-end text-xs gap-1" style={{ color: `${C.cream}50` }}>
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
