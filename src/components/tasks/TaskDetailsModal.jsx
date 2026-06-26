// @ts-nocheck
import React, { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateSubmission, useSubmitProof } from "@/hooks/useSubmissions";
import { useMyMetricsSubmissions, useSubmitMetricsSubmission } from "@/hooks/useMetrics";
import { usePaymentInfo } from "@/hooks/usePayments";
import { useUploadFile } from "@/hooks/useStorage";
import { getProofMetricsWindowFromSubmission, getMetricsResubmissionDeadline, METRICS_WAIT_AFTER_PROOF_DAYS, METRICS_SUBMISSION_WINDOW_DAYS } from '@/lib/metrics-window';
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
import { Calendar, Clock, Users, Star, CircleDollarSign, UserRoundCheck, Send, Upload, BarChart3, CheckCircle2, X, User } from "lucide-react";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/toast";
import { C, heading, body } from '@/lib/theme';
import { CATEGORY_ACCENT } from "@/pages/Tasks";
import { formatLaunchDateTime, isTaskScheduled } from '@/lib/task-scheduling';

const CATEGORY_NAMES = {
  campanha: "Campanha",
  resposta_rapida: "Resposta Rápida",
  oficina: "Oficina",
  folhetim: "Folhetim",
  compartilhar_ecoante: "Compartilhar Ecoante",
  sidequest_teste: "Missão",
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

// ─── Estilo visual (paleta Figma Make) ──────────────────────────────────────
const SURFACE_BG = 'rgba(255,255,222,0.06)';
const SURFACE_BORDER = '1px solid rgba(255,255,222,0.07)';
const DIVIDER = '1px solid rgba(255,255,222,0.07)';

const inputCls = "!bg-black !border-white/10 text-white placeholder:text-white/30 rounded-xl focus-visible:ring-1 focus-visible:ring-white/20";

export default function TaskDetailsModal({ task, onClose, isTaskClaimed, isTaskApproved, currentSubmission, cardIndex = 0 }) {
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

  const isCampaignTask = task?.category === 'campanha';
  const accent = isCampaignTask ? C.orange : C.lime;
  const accentBg = isCampaignTask ? C.orange_back : C.lime_back;
  const accentText = accent === C.lime ? C.black : C.cream;

  const COLUMN_COLORS = [
    { color: C.blue, bg: C.blue_back },
    { color: C.orange, bg: C.orange_back },
    { color: C.lime, bg: C.lime_back },
  ];
  const safeCardIndex = cardIndex >= 0 ? cardIndex : 0;
  const columnColor = COLUMN_COLORS[safeCardIndex % COLUMN_COLORS.length];
  const columnAccent = columnColor.color;
  const columnAccentBg = columnColor.bg;
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
  const isScheduled = isTaskScheduled(task);
  const launchLabel = isScheduled ? formatLaunchDateTime(task.launch_at) : null;
  const canApply = (!currentSubmission || isSubmissionReopenedByDateChange) && !isTaskApproved && !isFull && meetsFollowersRequirement && !isScheduled;
  const canSubmitProof = (
    (submissionStatus === 'application_approved' || submissionStatus === 'rejected' || (isSidequestTask && submissionStatus === 'application_pending'))
    && !isProofDeadlineExpired
  );
  const isWaiting = ['application_pending', 'proof_pending', 'pending'].includes(submissionStatus);
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
  const proofApprovalMetricsWindow = getProofMetricsWindowFromSubmission(currentSubmission);
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
    if (isCampaignTask && hasPassedStep2 && !isMetricsCompleted && metricsWindowEnd && !hasMetricsWindowPassed) {
      return {
        label: metricsWindowStart && now < metricsWindowStart ? 'Métricas liberam em' : 'Prazo das métricas até',
        date: metricsWindowStart && now < metricsWindowStart ? metricsWindowStart : metricsWindowEnd,
      };
    }

    if (hasProofDeadline && !hasPassedStep2) {
      return {
        label: 'Prazo do conteúdo até',
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
  }, [isCampaignTask, hasPassedStep2, isMetricsCompleted, metricsWindowStart, metricsWindowEnd, hasMetricsWindowPassed, hasProofDeadline, proofDeadline, task.expires_at, timeLeft, now]);

  const submissionStageLabel = isSidequestTask && submissionStatus === 'application_pending'
    ? SIDEQUEST_PENDING_TEXT
    : STATUS_TEXT[submissionStatus] || 'Inscrição em análise';

  const metricsWindowHoverText = metricsWindowLabel
    ? `Envio de métricas: de ${metricsWindowLabel}.`
    : `A janela de envio de métricas será disponibilizada ${METRICS_WAIT_AFTER_PROOF_DAYS} dias após o envio da prova, por ${METRICS_SUBMISSION_WINDOW_DAYS} dias.`;

  const metricsSubmitHint = (!metricsFiles || metricsFiles.length === 0)
    ? 'Anexe o arquivo de métricas para enviar.'
    : hasResubmissionWindowExpired
      ? 'Prazo de reenvio encerrado (2 dias após a rejeição).'
      : hasMetricsWindowPassed
        ? 'A janela de envio de métricas foi encerrada.'
        : !isInsideMetricsWindow
          ? (metricsWindowLabel
            ? `As métricas só poderão ser enviadas entre ${metricsWindowLabel}.`
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
              ? `Envio liberado entre ${metricsWindowLabel}.`
              : 'A janela de envio de métricas ainda não começou.')
            : '';

  const metricsButtonTitle = [metricsWindowHoverText, metricsSubmitHint].filter(Boolean).join(' ');


  // ── Lógica do Cronograma (Adicionar antes do handleApply) ──
  const completedStepsCount = useMemo(() => {
    let completed = 0;
    if (hasPassedStep1) completed++;
    if (hasPassedStep2) completed++;
    if (isCampaignTask && isMetricsCompleted) completed++;
    return completed;
  }, [hasPassedStep1, hasPassedStep2, isCampaignTask, isMetricsCompleted]);

  const timelineSteps = useMemo(() => {
    const steps = [];

    // Etapa 1
    steps.push({
      label: "Candidatar-se",
      description: isSidequestTask ? "Ao se candidatar, você já fica inscrito." : "Envie sua candidatura para análise",
      dateInfo: task.posting_deadline
        ? `até ${new Date(task.posting_deadline).toLocaleDateString('pt-BR')} ${new Date(task.posting_deadline).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
        : "Sem data definida"
    });

    // Etapa 2
    steps.push({
      label: "Enviar link da tarefa",
      description: "Envie o link do seu conteúdo publicado",
      dateInfo: hasProofDeadline
        ? `até ${proofDeadline.toLocaleDateString('pt-BR')} ${proofDeadline.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
        : task.expires_at
          ? `até ${new Date(task.expires_at).toLocaleDateString('pt-BR')} ${new Date(task.expires_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
          : "Sem data definida"
    });

    // Etapa 3 (Apenas para Campanhas)
    if (isCampaignTask) {
      steps.push({
        label: "Enviar métricas",
        description: metricsWindowStart && metricsWindowEnd
          ? `Entre ${metricsWindowStart.toLocaleDateString('pt-BR')} e ${metricsWindowEnd.toLocaleDateString('pt-BR')}`
          : `${METRICS_WAIT_AFTER_PROOF_DAYS} dias após a prova, por ${METRICS_SUBMISSION_WINDOW_DAYS} dias`,
        dateInfo: null
      });
    }

    return steps;
  }, [task, isSidequestTask, hasProofDeadline, proofDeadline, isCampaignTask, metricsWindowStart, metricsWindowEnd]);


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
      notifyWarning(`As métricas só podem ser enviadas entre ${metricsWindowLabel || `${METRICS_WAIT_AFTER_PROOF_DAYS} dias após a prova e por mais ${METRICS_SUBMISSION_WINDOW_DAYS} dias`}.`);
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
      <DialogContent
        className="max-w-xl max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0 sm:rounded-2xl !bg-[#161616] !border-white/10 [&>button]:hidden"
        style={{ color: C.cream }}
      >
        {/* ── Header sticky ── */}
        <DialogHeader
          className="shrink-0 flex flex-row items-start justify-between gap-3 px-6 pt-6 pb-4 space-y-0"
          style={{ borderBottom: DIVIDER }}
        >
          <div className="flex-1 min-w-0">
            <DialogTitle style={{ ...heading, fontSize: 20, fontWeight: 800, color: C.cream, marginBottom: 10 }}>
              {task.title}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold" style={{ backgroundColor: columnAccentBg, border: `1px solid ${columnAccent}25`, color: columnAccent, ...heading }}>
                  {displayCategory}
                </span>
                {task.requires_application && !isSidequestTask && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold" style={{ backgroundColor: columnAccentBg, border: `1px solid ${columnAccent}25`, color: columnAccent, ...heading }}>
                    Requer Inscrição e Seleção
                  </span>
                )}
              </div>
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center hover:opacity-70 transition-opacity"
            style={{ backgroundColor: 'rgba(255,255,222,0.07)', color: `${C.cream}60` }}
          >
            <X size={14} />
          </button>
        </DialogHeader>

        {/* ── Body scrollável ── */}
        <div className="overflow-y-auto px-6 py-6 flex flex-col gap-5">

          {isScheduled && launchLabel && (
            <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: 'rgba(170,102,255,0.12)', border: '1px solid rgba(170,102,255,0.2)', color: C.purple }}>
              <div className="flex items-center gap-2 font-semibold mb-1">
                <Calendar size={14} />
                Lançamento agendado
              </div>
              <p style={{ color: `${C.cream}80`, fontSize: 13 }}>
                Esta tarefa será liberada em <strong style={{ color: C.cream }}>{launchLabel}</strong>. Você poderá se candidatar a partir desse horário.
              </p>
            </div>
          )}

          {/* Pagamento + Vagas */}
          <div className={`grid grid-cols-1 ${task.max_participants ? 'sm:grid-cols-2' : ''} gap-3`}>
            <div className="rounded-xl p-4" style={{ backgroundColor: SURFACE_BG, border: SURFACE_BORDER }}>
              <p style={{ fontSize: 10, color: `${C.cream}45`, marginBottom: 6 }}>Pagamento / Pontuação</p>
              <div className="flex items-center gap-1.5">
                <CircleDollarSign size={14} style={{ color: accent }} />
                <p style={{ ...heading, fontSize: 22, fontWeight: 900, color: accent }}>
                  {isCampaignTask ? `R$ ${offeredValue.toLocaleString('pt-BR')}` : `${offeredValue.toLocaleString('pt-BR')} pts`}
                </p>
              </div>
            </div>

            {task.max_participants && (
              <div className="rounded-xl p-4" style={{ backgroundColor: SURFACE_BG, border: SURFACE_BORDER }}>
                <p style={{ fontSize: 10, color: `${C.cream}45`, marginBottom: 6 }}>Vagas Preenchidas</p>
                <div className="flex items-center gap-1.5">
                  <p style={{ ...heading, fontSize: 22, fontWeight: 900, color: "white" }}>
                    <span style={{ color: `${C.cream}70` }}>{task.current_participants || 0}</span>/{task.max_participants}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Tipo de conteúdo — destaque, estilo Figma */}
          {Array.isArray(task.content_formats) && task.content_formats.length > 0 && (
            <div className="rounded-xl p-4" style={{ backgroundColor: columnAccentBg, border: `1px solid ${columnAccent}25` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: columnAccent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                Tipo de Conteúdo
              </div>
              <div className="flex flex-wrap gap-2">
                {task.content_formats.map((f) => (
                  <span key={f} className="px-3 py-1.5 rounded-xl text-xs font-semibold" style={{ backgroundColor: columnAccentBg, color: columnAccent }}>
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Perfil Desejado */}
          <div className="rounded-xl p-4" style={{ backgroundColor: SURFACE_BG, border: SURFACE_BORDER }}>
            <div className="flex items-center gap-2 mb-3">
              <User size={13} style={{ color: C.lime }} />
              <span style={{ ...heading, fontSize: 13, fontWeight: 700, color: C.cream }}>Perfil Desejado</span>
            </div>
            {task.profile_requirements && (
              <p className="text-xs mb-2" style={{ color: `${C.cream}70` }}>{task.profile_requirements}</p>
            )}
            <ul className="flex flex-col gap-1.5">
              <li className="flex items-start gap-2" style={{ fontSize: 12, color: `${C.cream}60` }}>
                <span style={{ color: `${C.cream}25` }}>•</span>
                Mínimo de {task.min_followers || 0} seguidores
              </li>
              <li className="flex items-start gap-2" style={{ fontSize: 12, color: `${C.cream}60` }}>
                <span style={{ color: `${C.cream}25` }}>•</span>
                Formato de entrega: {displayProofType}
              </li>
            </ul>
          </div>

          {/* Descrição */}
          <div>
            <div style={{ ...heading, fontSize: 15, fontWeight: 700, color: C.cream, marginBottom: 8 }}>Descrição da Tarefa</div>
            {task.description ? (
              (() => {
                const shouldShowToggle = String(task.description || '').length > 240 || String(task.description || '').includes('\n\n');
                if (showFullDescription) {
                  return (
                    <>
                      <p className="whitespace-pre-wrap break-words break-all" style={{ fontSize: 13, color: `${C.cream}70`, lineHeight: 1.65 }}>{task.description}</p>
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
                    <p className="line-clamp-3 break-words break-all whitespace-pre-wrap" style={{ fontSize: 13, color: `${C.cream}70`, lineHeight: 1.65 }}>{task.description}</p>
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
              <p style={{ fontSize: 13, color: `${C.cream}50` }}>-</p>
            )}
            {hasValidSubmittedAt && (
              <div className="flex items-center gap-1.5 mt-3" style={{ fontSize: 11, color: `${C.cream}35` }}>
                <Clock size={10} />
                Submissão enviada em {submittedAt.toLocaleDateString('pt-BR')} às {submittedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            )}

            {/* ── Visual Cronograma ── */}
            <div className="pt-6 pb-2" style={{ borderTop: DIVIDER }}>
              <div className="flex items-center justify-between mb-4">
                <span style={{ fontSize: 11, fontWeight: 700, color: `${C.cream}60`, letterSpacing: "0.1em", textTransform: "uppercase" }}>Cronograma</span>
              </div>

              {/* Barra de Progresso */}
              <div className="flex items-center gap-3 mb-6">
                <div style={{ flex: 1, height: 6, borderRadius: 999, background: SURFACE_BG, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(completedStepsCount / timelineSteps.length) * 100}%`, background: columnAccent, transition: "width 0.3s ease-in-out" }} />
                </div>
                <span style={{ fontSize: 12, color: `${C.cream}50` }}>{completedStepsCount}/{timelineSteps.length} etapas</span>
              </div>

              {/* Lista de Etapas */}
              <div className="flex flex-col gap-0">
                {timelineSteps.map((step, i) => {
                  const isCompleted = i < completedStepsCount;
                  const isCurrent = i === completedStepsCount;
                  const isActive = isCompleted || isCurrent;

                  const circleBg = isActive ? columnAccentBg : SURFACE_BG;
                  const circleBorder = isActive ? `1px solid ${columnAccent}45` : SURFACE_BORDER;
                  const circleColor = isActive ? columnAccent : `${C.cream}40`;

                  return (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10" style={{ backgroundColor: circleBg, border: circleBorder, color: circleColor }}>
                          {isCompleted ? <CheckCircle2 size={16} /> : <span style={{ fontSize: 13, fontWeight: 800 }}>{i + 1}</span>}
                        </div>
                        {i < timelineSteps.length - 1 && (
                          <div className="w-[2px] h-full my-1 rounded-full" style={{ backgroundColor: isCompleted ? columnAccentBg : SURFACE_BG }}></div>
                        )}
                      </div>
                      <div className={`pb-6 ${!isActive ? 'opacity-50' : ''}`}>
                        <p style={{ ...heading, fontSize: 15, fontWeight: 700, color: C.cream }}>{step.label}</p>
                        <p style={{ fontSize: 13, color: `${C.cream}70`, marginTop: 2 }}>{step.description}</p>
                        {step.dateInfo && (
                          <p className="flex items-center gap-1.5 mt-2" style={{ fontSize: 12, color: `${C.cream}40` }}>
                            <Clock size={12} />
                            {step.dateInfo}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Formulários Dinâmicos (Mostra apenas a ação atual) ── */}
            <div className="flex flex-col gap-4 mt-2">

              {/* Formulário Etapa 1 */}
              {!hasPassedStep1 && submissionStatus !== 'approved' && (

                <form onSubmit={handleApply}>
                  {isScheduled && launchLabel && (
                    <div className="mb-3 text-xs rounded-xl p-3" style={{ backgroundColor: 'rgba(170,102,255,0.12)', color: C.purple, border: '1px solid rgba(170,102,255,0.2)' }}>
                      Agendada para {launchLabel}. A participação será liberada automaticamente no horário.
                    </div>
                  )}
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
                    className="w-full flex justify-center items-center h-8 rounded-xl transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: C.blue, color: C.cream, ...heading, fontSize: 14, fontWeight: 700 }}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {isTaskApproved || submissionStatus === 'approved'
                      ? 'Tarefa concluída'
                      : isSubmissionReopenedByDateChange
                        ? 'Candidatar-se para esta Vaga'
                        : canSubmitProof
                          ? isSidequestTask && submissionStatus === 'application_pending'
                            ? 'Avançar para prova da Missão'
                            : submissionStatus === 'rejected'
                              ? 'Prova rejeitada - reenviar'
                              : 'Inscrição aprovada - ir para prova'
                          : isWaiting
                            ? submissionStageLabel
                            : isSubmissionExpiredByRule
                              ? 'Prazo expirado'
                              : isFull
                                ? 'Vagas encerradas'
                                : isScheduled
                                  ? `Agendada para ${launchLabel}`
                                  : isSubmitting
                                    ? 'Enviando...'
                                    : 'Candidatar-se para esta Vaga'}
                  </button>
                </form>

              )}

              {/* Formulário Etapa 2 */}
              {!hasPassedStep2 && isStep2Current && (
                <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ backgroundColor: SURFACE_BG, border: SURFACE_BORDER }}>
                  {submissionStatus === 'proof_pending' ? (
                    <div className="text-xs rounded-xl p-3 text-center" style={{ backgroundColor: 'rgba(68,102,255,0.12)', color: '#8899FF', border: '1px solid rgba(68,102,255,0.2)' }}>
                      Sua prova foi enviada e está em análise pelo administrador.
                    </div>
                  ) : (
                    <form onSubmit={handleSendProof} className="flex flex-col gap-4">
                      {/* ... SEUS INPUTS ORIGINAIS DE PROOF CONTINUAM AQUI ... */}
                      <div>
                        <Label htmlFor="proof-link" style={{ color: `${C.cream}70`, fontSize: 12 }}>Link da prova</Label>
                        <Input id="proof-link" type="url" value={proofLink} onChange={(e) => setProofLink(e.target.value)} placeholder="Cole o link da prova" className={`mt-1.5 h-[46px] ${inputCls}`} />
                      </div>
                      <div>
                        <Label htmlFor="proof-file" style={{ color: `${C.cream}70`, fontSize: 12 }}>Arquivo da prova (Opcional)</Label>
                        <input id="proof-file" type="file" onChange={(e) => setProofFile(e.target.files?.[0] || null)} className="block w-full mt-1.5 text-sm file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold transition-all file:bg-white/10 file:text-white hover:file:bg-white/20 file:cursor-pointer cursor-pointer text-white/50" />
                      </div>
                      <button
                        type="submit"
                        disabled={isSubmitting || uploadFile.isPending || submitProof.isPending}
                        className="w-full flex justify-center items-center h-[48px] rounded-xl transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ backgroundColor: C.lime, color: C.black, ...heading, fontSize: 14, fontWeight: 700 }}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {isSubmitting || uploadFile.isPending || submitProof.isPending ? 'Enviando prova...' : 'Enviar prova para aprovação'}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Formulário Etapa 3 */}
              {isCampaignTask && hasPassedStep2 && !isMetricsCompleted && (
                <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ backgroundColor: SURFACE_BG, border: SURFACE_BORDER }}>
                  {metricsStatus === 'pending' ? (
                    <div className="text-xs rounded-xl p-3 text-center" style={{ backgroundColor: 'rgba(68,102,255,0.12)', color: '#8899FF', border: '1px solid rgba(68,102,255,0.2)' }}>
                      Métricas enviadas. Em análise.
                    </div>
                  ) : (
                    <form onSubmit={handleSendMetrics} className="flex flex-col gap-4">
                      {/* ... SEUS INPUTS ORIGINAIS DE MÉTRICAS CONTINUAM AQUI ... */}
                      <div>
                        <Label htmlFor="metrics-file" style={{ color: `${C.cream}70`, fontSize: 12 }}>Arquivo de métricas (Obrigatório)</Label>
                        <input id="metrics-file" type="file" multiple onChange={(e) => setMetricsFiles(Array.from(e.target.files || []))} className="block w-full mt-1.5 text-sm file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold transition-all file:bg-white/10 file:text-white hover:file:bg-white/20 file:cursor-pointer cursor-pointer text-white/50" />
                      </div>
                      <div title={metricsButtonTitle || undefined}>
                        <button
                          type="submit"
                          disabled={isSubmitting || uploadFile.isPending || submitMetrics.isPending || !metricsFiles || metricsFiles.length === 0 || !isInsideMetricsWindow || hasResubmissionWindowExpired}
                          className="w-full flex justify-center items-center h-[48px] rounded-xl transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ backgroundColor: C.orange, color: C.black, ...heading, fontSize: 14, fontWeight: 700 }}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          {isSubmitting || uploadFile.isPending || submitMetrics.isPending ? 'Enviando métricas...' : 'Enviar métricas'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

            </div>
          </div>

          {shouldShowSubmissionRejectionReason && (
            <div className="rounded-xl p-3" style={{ backgroundColor: 'rgba(255,34,85,0.12)', border: '1px solid rgba(255,34,85,0.2)' }}>
              <p className="text-xs font-semibold mb-1" style={{ color: '#FF2255' }}>Motivo da rejeição</p>
              <p className="text-sm" style={{ color: '#FF2255' }}>{currentSubmission.rejection_reason}</p>
            </div>
          )}

          {footerStageDeadline?.date && (
            <div className="flex items-center justify-end gap-1.5" style={{ color: `${C.cream}30`, fontSize: 12 }}>
              <Clock size={9} />
              <span>
                {footerStageDeadline.label} {footerStageDeadline.date.toLocaleString('pt-BR')}
              </span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}