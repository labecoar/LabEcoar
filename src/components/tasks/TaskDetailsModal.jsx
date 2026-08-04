// @ts-nocheck
import React, { useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateSubmission, useSubmitProof, useSubmitScript } from "@/hooks/useSubmissions";
import { useMyMetricsSubmissions, useSubmitMetricsSubmission } from "@/hooks/useMetrics";
import { usePaymentInfo } from "@/hooks/usePayments";
import { useUploadFile } from "@/hooks/useStorage";
import { getProofMetricsWindowFromSubmission, getMetricsResubmissionDeadline, METRICS_WAIT_AFTER_PROOF_DAYS } from '@/lib/metrics-window';
import { metricsService } from '@/services/metrics.service';
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
import { C, heading, body, getModalBackground } from '@/lib/theme';
import { useThemeMode } from '@/contexts/ThemeContext';
import { getCategoryStyle } from "@/pages/Tasks";
import { formatLaunchDateTime, isTaskScheduled } from '@/lib/task-scheduling';
import { TaskDescriptionContent } from '@/components/tasks/TaskDescriptionContent';
import { isRichTextDescription, getDescriptionPlainText } from '@/lib/task-description-format';

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

const STATUS_TEXT = {
  application_pending: 'Inscrição em análise',
  application_approved: 'Inscrição aprovada',
  application_rejected: 'Inscrição rejeitada',
  script_pending: 'Roteiro em análise',
  script_approved: 'Roteiro aprovado',
  script_rejected: 'Roteiro rejeitado',
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
const SURFACE_BG = 'rgba(var(--ink),0.06)';
const SURFACE_BORDER = '1px solid rgba(var(--ink),0.07)';
const DIVIDER = '1px solid rgba(var(--ink),0.07)';

const inputCls = "!bg-[rgba(var(--ink),0.06)] !border-[rgba(var(--ink),0.12)] text-[rgb(var(--ink))] placeholder:text-[rgba(var(--ink),0.35)] rounded-xl focus-visible:ring-1 focus-visible:ring-[rgba(var(--ink),0.2)]";
const fileInputCls = "block w-full mt-1.5 text-sm text-transparent file:mr-0 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold transition-all file:bg-[rgba(var(--ink),0.1)] file:text-[rgb(var(--ink))] hover:file:bg-[rgba(var(--ink),0.2)] file:cursor-pointer cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
const MAX_PROOF_FILES = 5;

export default function TaskDetailsModal({ task, onClose, isTaskClaimed, isTaskApproved, currentSubmission, cardIndex = 0 }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [proofDescription, setProofDescription] = useState('');
  const [proofLink, setProofLink] = useState('');
  const [proofFiles, setProofFiles] = useState([]);
  const [scriptDescription, setScriptDescription] = useState('');
  const [scriptLink, setScriptLink] = useState('');
  const [scriptFiles, setScriptFiles] = useState([]);
  const [metricsDescription, setMetricsDescription] = useState('');
  const [metricsLink, setMetricsLink] = useState('');
  const [metricsFiles, setMetricsFiles] = useState([]);
  const proofFileInputRef = useRef(null);
  const scriptFileInputRef = useRef(null);
  const { user, profile } = useAuth();
  const { isLight, T } = useThemeMode();
  const createSubmission = useCreateSubmission();
  const submitProof = useSubmitProof();
  const submitScript = useSubmitScript();
  const submitMetrics = useSubmitMetricsSubmission();
  const uploadFile = useUploadFile();
  const { data: paymentInfo } = usePaymentInfo(user?.id);
  const { data: myMetricsSubmissions = [] } = useMyMetricsSubmissions(user?.id);

  const handleProofFilesChange = (e) => {
    const novos = Array.from(e.target.files || []);
    setProofFiles((prev) => [...prev, ...novos].slice(0, MAX_PROOF_FILES));
    e.target.value = '';
  };

  const handleScriptFilesChange = (e) => {
    const novos = Array.from(e.target.files || []);
    setScriptFiles((prev) => [...prev, ...novos].slice(0, MAX_PROOF_FILES));
    e.target.value = '';
  };

  const removeProofFile = (index) => {
    setProofFiles((prev) => prev.filter((_, idx) => idx !== index));
    if (proofFileInputRef.current) proofFileInputRef.current.value = '';
  };

  const removeScriptFile = (index) => {
    setScriptFiles((prev) => prev.filter((_, idx) => idx !== index));
    if (scriptFileInputRef.current) scriptFileInputRef.current.value = '';
  };

  if (!task) return null;

  const labelColor = isLight ? T.textMuted : `${C.cream}45`;
  const subColor = isLight ? T.textSub : `${C.cream}60`;
  const bodyMuted = isLight ? T.textSub : `${C.cream}70`;
  const faintColor = isLight ? T.textFaint : `${C.cream}40`;
  const softColor = isLight ? T.textMuted : `${C.cream}50`;
  const dimColor = isLight ? T.textFaint : `${C.cream}35`;
  const strongMuted = isLight ? T.textSub : `${C.cream}80`;
  const bulletColor = isLight ? T.textFaint : `${C.cream}25`;
  const surfaceBg = isLight ? T.surface : SURFACE_BG;
  const surfaceBorder = isLight ? `1px solid ${T.border}` : SURFACE_BORDER;
  const modalBg = getModalBackground(isLight);

  const isCampaignTask = task?.category === 'campanha';
  const isSidequestTask = task?.category === 'sidequest_teste';
  const { color: categoryAccent, bg: categoryAccentBg } = getCategoryStyle(task.category);
  const accent = isLight && categoryAccent === C.lime ? C.blue : categoryAccent;
  const accentBg = isLight && categoryAccent === C.lime ? C.blue_back : categoryAccentBg;
  const accentText = accent === C.lime
    ? C.onAccent
    : accent === C.blue
      ? C.onSurface
      : C.cream;
  const actionButtonClassName = "w-full flex justify-center items-center min-h-[48px] px-4 py-3 rounded-xl text-center transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100";
  const actionButtonStyle = { backgroundColor: accent, color: accentText, ...heading, fontSize: 14, fontWeight: 700 };
  const displayCategory = CATEGORY_NAMES[task.category] || task.category;
  const displayProofType = useMemo(() => getProofTypeLabel(task), [task]);
  const offeredValue = Number(task.offered_value || task.points || 0);
  const userFollowers = Number(profile?.followers_count || 0);
  const minFollowersRequired = Number(task?.min_followers || 0);
  const meetsFollowersRequirement = userFollowers >= minFollowersRequired;
  const isFull = Boolean(task.max_participants) && Number(task.current_participants || 0) >= Number(task.max_participants);
  const submissionStatus = currentSubmission?.status;
  const submittedAt = currentSubmission?.proof_submitted_at
    ? new Date(currentSubmission.proof_submitted_at)
    : null;
  const hasValidSubmittedAt = submittedAt && !Number.isNaN(submittedAt.getTime());
  const proofDeadline = task?.category === 'campanha'
    ? (task?.posting_deadline ? new Date(task.posting_deadline) : null)
    : (task?.expires_at ? new Date(task.expires_at)
      : task?.delivery_deadline ? new Date(task.delivery_deadline)
        : task?.posting_deadline ? new Date(task.posting_deadline) : null);
  const hasProofDeadline = proofDeadline && !Number.isNaN(proofDeadline.getTime());
  const isProofDeadlineExpired = hasProofDeadline ? new Date() > proofDeadline : false;
  const isSubmissionExpiredByRule = isAutoExpiredSubmissionRejection(currentSubmission) && isProofDeadlineExpired;
  const isSubmissionReopenedByDateChange = isAutoExpiredSubmissionRejection(currentSubmission) && !isProofDeadlineExpired;
  const shouldShowSubmissionRejectionReason = Boolean(currentSubmission?.rejection_reason) && !isSubmissionReopenedByDateChange;
  const isScheduled = isTaskScheduled(task);
  const launchLabel = isScheduled ? formatLaunchDateTime(task.launch_at) : null;
  const requiresScript = isCampaignTask;
  const canApply = (!currentSubmission || isSubmissionReopenedByDateChange) && !isTaskApproved && !isFull && meetsFollowersRequirement && !isScheduled;
  const canSubmitScript = requiresScript
    && ['application_approved', 'script_rejected'].includes(submissionStatus)
    && !isProofDeadlineExpired;
  const canSubmitProof = requiresScript
    ? ['script_approved', 'rejected'].includes(submissionStatus) && !isProofDeadlineExpired
    : (
      (submissionStatus === 'application_approved' || submissionStatus === 'rejected' || (isSidequestTask && submissionStatus === 'application_pending'))
      && !isProofDeadlineExpired
    );
  const isWaiting = ['application_pending', 'script_pending', 'proof_pending', 'pending'].includes(submissionStatus);
  const isParticipateAction = (isSidequestTask || isCampaignTask) && canApply && !canSubmitProof && !isWaiting;
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
  const canSubmitMetrics = isCampaignTask
    && submissionStatus === 'approved'
    && (!currentMetricsSubmission || metricsStatus === 'rejected')
    && isInsideMetricsWindow;
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
    : (requiresScript
      ? ['application_approved', 'script_pending', 'script_approved', 'script_rejected', 'proof_pending', 'rejected', 'approved'].includes(submissionStatus)
      : ['application_approved', 'proof_pending', 'rejected', 'approved'].includes(submissionStatus))
    ) && !canApply;
  const isScriptStepCurrent = requiresScript && ['application_approved', 'script_rejected'].includes(submissionStatus);
  const isScriptWaiting = requiresScript && submissionStatus === 'script_pending';
  const isProofStepCurrent = requiresScript
    ? ['script_approved', 'rejected'].includes(submissionStatus)
    : ['application_approved', 'rejected', 'proof_pending'].includes(submissionStatus)
      || (isSidequestTask && submissionStatus === 'application_pending');
  const hasPassedProofStep = ['proof_pending', 'approved'].includes(submissionStatus);
  const hasPassedStep2 = submissionStatus === 'approved';
  const isMetricsCompleted = metricsStatus === 'approved';
  const isScheduledAction = isScheduled && !isTaskApproved && submissionStatus !== 'approved' && !hasPassedStep1;

  const submissionStageLabel = isSidequestTask && submissionStatus === 'application_pending'
    ? SIDEQUEST_PENDING_TEXT
    : STATUS_TEXT[submissionStatus] || 'Inscrição em análise';

  const metricsWindowHoverText = metricsWindowLabel
    ? `Envio de métricas: de ${metricsWindowLabel}.`
    : `A janela de envio de métricas será disponibilizada ${METRICS_WAIT_AFTER_PROOF_DAYS} dias após a aprovação do conteúdo.`;

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
            ? (metricsWindowStart
              ? `Envio liberado a partir de ${metricsWindowStart.toLocaleDateString('pt-BR')} às ${metricsWindowStart.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`
              : 'A janela de envio de métricas ainda não começou.')
            : '';

  const metricsButtonTitle = [metricsWindowHoverText, metricsSubmitHint].filter(Boolean).join(' ');


  // ── Lógica do Cronograma (Adicionar antes do handleApply) ──
  const completedStepsCount = useMemo(() => {
    let completed = 0;
    if (hasPassedStep1) completed++;
    if (requiresScript && ['script_pending', 'script_approved', 'proof_pending', 'rejected', 'approved'].includes(submissionStatus)) completed++;
    if (['proof_pending', 'approved'].includes(submissionStatus)) completed++;
    if (isCampaignTask && isMetricsCompleted) completed++;
    return completed;
  }, [hasPassedStep1, requiresScript, submissionStatus, isCampaignTask, isMetricsCompleted]);

  const timelineSteps = useMemo(() => {
    const steps = [];
    const postingDeadlineLabel = formatLaunchDateTime(task.posting_deadline);
    const proofDeadlineLabel = hasProofDeadline
      ? formatLaunchDateTime(proofDeadline)
      : null;
    const metricsStartLabel = formatLaunchDateTime(metricsWindowStart);

    if (isSidequestTask) {
      steps.push({
        label: "Participar desta Missão",
        description: "Clique no botão abaixo para participar desta missão e liberar o envio do seu conteúdo.",
        dateInfoPrefix: postingDeadlineLabel ? 'até ' : null,
        dateTimeLabel: postingDeadlineLabel,
      });
    } else {
      steps.push({
        label: "Candidatar-se",
        description: isCampaignTask
          ? "Clique no botão abaixo para se candidatar a esta campanha. Após a aprovação, você poderá enviar seu conteúdo."
          : "Clique no botão abaixo para se candidatar a esta tarefa. Após a aprovação, você poderá enviar seu conteúdo.",
        dateInfoPrefix: postingDeadlineLabel ? 'até ' : null,
        dateTimeLabel: postingDeadlineLabel,
      });
    }

    steps.push({
      label: "Enviar conteúdo da tarefa",
      description: isSidequestTask
        ? "Envie o link e/ou o arquivo do seu conteúdo"
        : "Envie o link e/ou o arquivo do seu conteúdo para validação.",
      dateInfoPrefix: proofDeadlineLabel ? 'até ' : null,
      dateTimeLabel: proofDeadlineLabel,
    });

    if (isCampaignTask) {
      steps.splice(1, 0, {
        label: "Enviar roteiro",
        description: "Envie seu roteiro em PDF, DOCX, Google Docs ou link.",
        dateInfoPrefix: proofDeadlineLabel ? 'até ' : null,
        dateTimeLabel: proofDeadlineLabel,
      });
    }

    // Etapa de métricas (apenas campanhas)
    if (isCampaignTask) {
      steps.push({
        label: "Enviar métricas",
        description: metricsWindowStart ? "Disponível a partir de" : null,
        dateTimeLabel: metricsWindowStart
          ? metricsStartLabel
          : `${METRICS_WAIT_AFTER_PROOF_DAYS} dias após a aprovação do conteúdo.`,
        dateInfoSuffix: null,
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

      notifySuccess(
        isSidequestTask
          ? 'Inscrito com sucesso! Já pode enviar sua prova. ✅'
          : 'Candidatura enviada com sucesso! Aguarde a aprovação do administrador. ✅'
      );
      onClose();
    } catch (error) {
      console.error('Erro ao candidatar-se:', error);
      notifyError(error?.message || 'Erro ao enviar candidatura.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendScript = async (e) => {
    e.preventDefault();
    if (!canSubmitScript || !currentSubmission?.id) return;

    const trimmedScriptLink = String(scriptLink || '').trim();

    if (!trimmedScriptLink && scriptFiles.length === 0) {
      notifyWarning('Envie pelo menos um roteiro: link e/ou arquivo.');
      return;
    }

    try {
      for (const f of scriptFiles) validateFileSize(f, 'Arquivo do roteiro');
    } catch (error) {
      notifyWarning(error.message);
      return;
    }

    setIsSubmitting(true);

    try {
      const uploadedUrls = [];
      for (const f of scriptFiles) {
        const result = await uploadFile.mutateAsync({ file: f, userId: user.id });
        if (result?.url) uploadedUrls.push(result.url);
      }

      const finalScriptUrl = trimmedScriptLink || uploadedUrls[0] || null;
      const extras = uploadedUrls.slice(trimmedScriptLink ? 0 : 1);
      const finalDescription = extras.length > 0
        ? `${scriptDescription || ''}\n\n${extras.map((u, i) => `Arquivo ${i + 1}: ${u}`).join('\n')}`.trim()
        : scriptDescription;

      await submitScript.mutateAsync({
        submissionId: currentSubmission.id,
        scriptData: {
          script_description: finalDescription,
          script_url: finalScriptUrl,
        },
      });

      notifySuccess('Roteiro enviado com sucesso! Aguarde a aprovação do administrador. ✅');
      onClose();
    } catch (error) {
      console.error('Erro ao enviar roteiro:', error);
      notifyError(error?.message || 'Erro ao enviar roteiro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendProof = async (e) => {
    e.preventDefault();
    if (!canSubmitProof || !currentSubmission?.id) return;

    const trimmedProofLink = String(proofLink || '').trim();

    if (!trimmedProofLink && proofFiles.length === 0) {
      notifyWarning('Envie pelo menos uma prova: link e/ou arquivo.');
      return;
    }

    try {
      for (const f of proofFiles) validateFileSize(f, 'Arquivo de prova');
    } catch (error) {
      notifyWarning(error.message);
      return;
    }

    setIsSubmitting(true);

    try {
      const uploadedUrls = [];
      for (const f of proofFiles) {
        const result = await uploadFile.mutateAsync({ file: f, userId: user.id });
        if (result?.url) uploadedUrls.push(result.url);
      }

      const finalProofUrl = trimmedProofLink || uploadedUrls[0] || null;
      const extras = uploadedUrls.slice(trimmedProofLink ? 0 : 1);
      const finalDescription = extras.length > 0
        ? `${proofDescription || ''}\n\n${extras.map((u, i) => `Arquivo ${i + 1}: ${u}`).join('\n')}`.trim()
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
    if (!metricsFiles || metricsFiles.length === 0) return;
    if (!canSubmitMetrics || !isInsideMetricsWindow) {
      notifyWarning(
        metricsWindowStart
          ? `As métricas só podem ser enviadas a partir de ${metricsWindowStart.toLocaleDateString('pt-BR')} às ${metricsWindowStart.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`
          : `As métricas só podem ser enviadas após ${METRICS_WAIT_AFTER_PROOF_DAYS} dias da aprovação do conteúdo.`
      );
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

      const metricsSubmission = await submitMetrics.mutateAsync({
        user,
        task,
        metricsFileUrls: uploaded,
        metricsLink,
        description: metricsDescription,
      });

      notifySuccess('Métricas enviadas com sucesso! Aguarde a análise do administrador.');

      try {
        await metricsService.notifyMetricsWebhook(metricsSubmission?.id);
        if (import.meta.env.DEV) {
          notifySuccess('[dev] Webhook n8n enviado com sucesso');
        }
      } catch (webhookError) {
        console.error('Erro ao chamar webhook:', webhookError);
        if (import.meta.env.DEV) {
          notifyWarning('[dev] Webhook n8n falhou');
        }
      }
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
        className="w-[calc(100vw-1rem)] sm:max-w-xl max-h-[90dvh] sm:max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0 rounded-2xl sm:rounded-2xl [&>button]:hidden"
        style={{ backgroundColor: modalBg, border: isLight ? `1px solid ${T.border}` : `1px solid rgba(var(--ink),0.1)`, color: C.cream }}
      >
        {/* ── Header sticky ── */}
        <DialogHeader
          className="shrink-0 flex flex-row items-start justify-between gap-3 px-4 sm:px-6 pt-5 sm:pt-6 pb-4 space-y-0"
          style={{ borderBottom: DIVIDER }}
        >
          <div className="flex-1 min-w-0">
            <DialogTitle style={{ ...heading, fontSize: 20, fontWeight: 800, color: C.cream, marginBottom: 10 }}>
              {task.title}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold" style={{ backgroundColor: accentBg, border: `1px solid ${accent}25`, color: accent, ...heading }}>
                  {displayCategory}
                </span>
                {task.requires_application && !isSidequestTask && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold" style={{ backgroundColor: accentBg, border: `1px solid ${accent}25`, color: accent, ...heading }}>
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
            style={{ backgroundColor: 'rgba(var(--ink),0.07)', color: subColor }}
          >
            <X size={14} />
          </button>
        </DialogHeader>

        {/* ── Body scrollável ── */}
        <div className="overflow-y-auto px-4 sm:px-6 py-5 sm:py-6 flex flex-col gap-5">

          {isScheduled && launchLabel && (
            <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: 'rgba(170,102,255,0.12)', border: '1px solid rgba(170,102,255,0.2)', color: C.purple }}>
              <div className="flex items-center gap-2 font-semibold mb-1">
                <Calendar size={14} />
                Lançamento agendado
              </div>
              <p style={{ color: strongMuted, fontSize: 13 }}>
                Agendada para <strong style={{ color: C.red }}>{launchLabel}</strong>. Você poderá se candidatar a partir desse horário.
              </p>
            </div>
          )}

          {/* Pagamento + Vagas */}
          <div className={`grid grid-cols-1 ${task.max_participants ? 'sm:grid-cols-2' : ''} gap-3`}>
            <div className="rounded-xl p-4" style={{ backgroundColor: isLight ? C.black_back : surfaceBg, border: surfaceBorder }}>
              <p style={{ fontSize: 10, color: labelColor, marginBottom: 6 }}>Pagamento / Pontuação</p>
              <div className="flex items-center gap-1.5">
                {isSidequestTask ? (
                  <Star size={16} style={{ color: accent, fill: accent }} />
                ) : (
                  <CircleDollarSign size={14} style={{ color: accent }} />
                )}
                <p style={{
                  ...heading,
                  fontSize: isSidequestTask ? 26 : 22,
                  fontWeight: 900,
                  color: accent,
                  letterSpacing: isSidequestTask ? "-0.02em" : undefined,
                }}>
                  {isCampaignTask ? `R$ ${offeredValue.toLocaleString('pt-BR')}` : `${offeredValue.toLocaleString('pt-BR')} pts`}
                </p>
              </div>
            </div>

            {task.max_participants && (
              <div className="rounded-xl p-4" style={{ backgroundColor: surfaceBg, border: surfaceBorder }}>
                <p style={{ fontSize: 10, color: labelColor, marginBottom: 6 }}>Vagas Preenchidas</p>
                <div className="flex items-center gap-1.5">
                  <p style={{ ...heading, fontSize: 22, fontWeight: 900, color: C.cream }}>
                    <span style={{ color: bodyMuted }}>{task.current_participants || 0}</span>/{task.max_participants}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Tipo de conteúdo — destaque, estilo Figma */}
          {Array.isArray(task.content_formats) && task.content_formats.length > 0 && (
            <div className="rounded-xl p-4" style={{ backgroundColor: accentBg, border: `1px solid ${accent}25` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                Tipo de Conteúdo
              </div>
              <div className="flex flex-wrap gap-2">
                {task.content_formats.map((f) => (
                  <span key={f} className="px-3 py-1.5 rounded-xl text-xs font-semibold" style={{ backgroundColor: accentBg, color: accent }}>
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Perfil Desejado */}
          <div className="rounded-xl p-4" style={{ backgroundColor: surfaceBg, border: surfaceBorder }}>
            <div className="flex items-center gap-2 mb-3">
              <User size={13} style={{ color: accent }} />
              <span style={{ ...heading, fontSize: 13, fontWeight: 700, color: C.cream }}>Perfil Desejado</span>
            </div>
            {task.profile_requirements && (
              <p className="text-xs mb-2" style={{ color: bodyMuted }}>{task.profile_requirements}</p>
            )}
            <ul className="flex flex-col gap-1.5">
              <li className="flex items-start gap-2" style={{ fontSize: 12, color: subColor }}>
                <span style={{ color: bulletColor }}>•</span>
                Mínimo de {task.min_followers || 0} seguidores
              </li>
              <li className="flex items-start gap-2" style={{ fontSize: 12, color: subColor }}>
                <span style={{ color: bulletColor }}>•</span>
                Formato de entrega: {displayProofType}
              </li>
            </ul>
          </div>

          {/* Descrição */}
          <div>
            <div style={{ ...heading, fontSize: 15, fontWeight: 700, color: C.cream, marginBottom: 8 }}>Descrição da Tarefa</div>
            {task.description ? (
              (() => {
                const descriptionText = String(task.description || '')
                const isRichDescription = isRichTextDescription(descriptionText)
                const plainDescription = getDescriptionPlainText(descriptionText)
                const richBlockCount = isRichDescription
                  ? (descriptionText.match(/<(p|h[1-3]|ul|ol)\b/gi) || []).length
                  : 0
                const shouldShowToggle = plainDescription.length > 240
                  || descriptionText.includes('\n\n')
                  || /^#{1,3}\s/m.test(descriptionText)
                  || (isRichDescription && (plainDescription.length > 120 || richBlockCount > 3))

                if (showFullDescription) {
                  return (
                    <>
                      <TaskDescriptionContent description={task.description} />
                      {shouldShowToggle && (
                        <button
                          type="button"
                          onClick={() => setShowFullDescription(false)}
                          className="text-xs hover:underline mt-2 block"
                          style={{ color: accent }}
                        >
                          Ver menos
                        </button>
                      )}
                    </>
                  );
                }

                return (
                  <>
                    <div
                      className={
                        isRichDescription
                          ? (shouldShowToggle ? 'max-h-28 overflow-hidden' : '')
                          : 'line-clamp-3 overflow-hidden'
                      }
                    >
                      <TaskDescriptionContent description={task.description} />
                    </div>
                    {shouldShowToggle && (
                      <button
                        type="button"
                        onClick={() => setShowFullDescription(true)}
                        className="text-xs hover:underline mt-2 block"
                        style={{ color: accent }}
                      >
                        Ver mais
                      </button>
                    )}
                  </>
                );
              })()
            ) : (
              <p style={{ fontSize: 13, color: softColor }}>-</p>
            )}
            {hasValidSubmittedAt && (
              <div className="flex items-center gap-1.5 mt-3" style={{ fontSize: 11, color: dimColor }}>
                <Clock size={10} />
                Submissão enviada em {submittedAt.toLocaleDateString('pt-BR')} às {submittedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
            )}

            {/* ── Visual Cronograma ── */}
            <div className="pt-6 pb-2" style={{ borderTop: DIVIDER }}>
              <div className="flex items-center justify-between mb-4">
                <span style={{ fontSize: 11, fontWeight: 700, color: subColor, letterSpacing: "0.1em", textTransform: "uppercase" }}>Cronograma</span>
              </div>

              {/* Barra de Progresso */}
              <div className="flex items-center gap-3 mb-6">
                <div style={{ flex: 1, height: 6, borderRadius: 999, background: surfaceBg, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(completedStepsCount / timelineSteps.length) * 100}%`, background: accent, transition: "width 0.3s ease-in-out" }} />
                </div>
                <span style={{ fontSize: 12, color: softColor }}>{completedStepsCount}/{timelineSteps.length} etapas</span>
              </div>

              {/* Lista de Etapas */}
              <div className="flex flex-col gap-0">
                {timelineSteps.map((step, i) => {
                  const isCompleted = i < completedStepsCount;
                  const isCurrent = i === completedStepsCount;
                  const isActive = isCompleted || isCurrent;

                  const circleBg = isActive ? accentBg : surfaceBg;
                  const circleBorder = isActive ? `1px solid ${accent}45` : surfaceBorder;
                  const circleColor = isActive ? accent : faintColor;

                  return (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10" style={{ backgroundColor: circleBg, border: circleBorder, color: circleColor }}>
                          {isCompleted ? <CheckCircle2 size={16} /> : <span style={{ fontSize: 13, fontWeight: 800 }}>{i + 1}</span>}
                        </div>
                        {i < timelineSteps.length - 1 && (
                          <div className="w-[2px] h-full my-1 rounded-full" style={{ backgroundColor: isCompleted ? accentBg : surfaceBg }}></div>
                        )}
                      </div>
                      <div className={`pb-6 ${!isActive ? 'opacity-50' : ''}`}>
                        <p style={{ ...heading, fontSize: 15, fontWeight: 700, color: C.cream }}>{step.label}</p>
                        {step.description && (
                          <p style={{ fontSize: 13, color: bodyMuted, marginTop: 2 }}>{step.description}</p>
                        )}
                        {step.dateTimeLabel && (
                          <p className="flex items-center gap-1.5 mt-2" style={{ fontSize: 12, color: faintColor }}>
                            <Clock size={12} />
                            {step.dateInfoPrefix && <span>{step.dateInfoPrefix}</span>}
                            <span style={{ color: C.red }}>{step.dateTimeLabel}</span>
                            {step.dateInfoSuffix && <span>{step.dateInfoSuffix}</span>}
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
                      Agendada para <strong style={{ color: C.red }}>{launchLabel}</strong>. Você poderá se candidatar a partir desse horário.
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
                    className={actionButtonClassName}
                    style={actionButtonStyle}
                  >
                    {isScheduledAction ? (
                      <Calendar className="w-4 h-4 mr-2" />
                    ) : (isSidequestTask && isParticipateAction) ? (
                      <Star className="w-4 h-4 mr-2" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    {isTaskApproved || submissionStatus === 'approved'
                      ? 'Tarefa concluída'
                      : isSubmissionReopenedByDateChange
                        ? (isSidequestTask
                          ? 'Participar desta Missão'
                          : isCampaignTask
                            ? (task.requires_application ? 'Candidatar-se para esta Vaga' : 'Participar desta Campanha')
                            : 'Candidatar-se para esta Vaga')
                        : canSubmitScript
                          ? submissionStatus === 'script_rejected'
                            ? 'Roteiro rejeitado - reenviar'
                            : 'Inscrição aprovada - enviar roteiro'
                          : canSubmitProof
                            ? isSidequestTask && submissionStatus === 'application_pending'
                              ? 'Avançar para prova da Missão'
                              : submissionStatus === 'rejected'
                                ? 'Prova rejeitada - reenviar'
                                : requiresScript
                                  ? 'Roteiro aprovado - enviar prova'
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
                                    : isSidequestTask
                                      ? 'Participar desta Missão'
                                      : isCampaignTask
                                        ? (task.requires_application ? 'Candidatar-se para esta Vaga' : 'Participar desta Campanha')
                                        : 'Candidatar-se para esta Vaga'}
                  </button>
                </form>

              )}

              {/* Formulário Etapa 2 — Roteiro (campanha) */}
              {requiresScript && !hasPassedProofStep && (isScriptStepCurrent || isScriptWaiting) && (
                <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ backgroundColor: surfaceBg, border: surfaceBorder }}>
                  <form onSubmit={handleSendScript} className="flex flex-col gap-4">
                    {submissionStatus !== 'script_pending' && (
                      <>
                      <div>
                        <Label htmlFor="script-link" style={{ color: bodyMuted, fontSize: 12 }}>Link do roteiro</Label>
                        <Input
                          id="script-link"
                          type="url"
                          value={scriptLink}
                          onChange={(e) => setScriptLink(e.target.value)}
                          placeholder="Cole o link do Google Docs ou outro link do roteiro"
                          className={`mt-1.5 h-[46px] ${inputCls}`}
                        />
                        <p style={{ fontSize: 11, color: faintColor, marginTop: 6, lineHeight: 1.45 }}>
                          Se for um Google Docs, verifique se o link está público ou com acesso liberado para quem tem o link.
                        </p>
                      </div>
                      <p style={{ fontSize: 12, color: bodyMuted, marginTop: 2 }}>E/ou anexe um arquivo do roteiro (PDF, DOCX, etc.):</p>
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor="script-file" style={{ color: bodyMuted, fontSize: 12 }}>Arquivo do roteiro</Label>
                          <span style={{ fontSize: 11, color: faintColor }}>Até {MAX_PROOF_FILES} arquivos</span>
                        </div>
                        <input
                          id="script-file"
                          ref={scriptFileInputRef}
                          type="file"
                          multiple
                          disabled={scriptFiles.length >= MAX_PROOF_FILES}
                          onChange={handleScriptFilesChange}
                          className={fileInputCls}
                        />
                        {scriptFiles.length > 0 && (
                          <div className="flex flex-col gap-2 mt-2">
                            {scriptFiles.map((file, i) => (
                              <div
                                key={`${file.name}-${file.size}-${file.lastModified}`}
                                className="flex items-center justify-between px-3 py-2 rounded-xl"
                                style={{ backgroundColor: 'rgba(var(--ink),0.04)', border: '1px solid rgba(var(--ink),0.08)' }}
                              >
                                <span style={{ fontSize: 12, color: bodyMuted }} className="truncate">{file.name}</span>
                                <button
                                  type="button"
                                  onClick={() => removeScriptFile(i)}
                                  style={{ color: bulletColor, marginLeft: 8 }}
                                  className="hover:opacity-100 opacity-60 shrink-0"
                                  aria-label={`Remover ${file.name}`}
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      </>
                    )}
                    <button
                      type="submit"
                      disabled={submissionStatus === 'script_pending' || isSubmitting || uploadFile.isPending || submitScript.isPending}
                      className={actionButtonClassName}
                      style={actionButtonStyle}
                    >
                      <Upload className="w-4 h-4 mr-2 shrink-0" />
                      {submissionStatus === 'script_pending'
                        ? 'Seu roteiro foi enviado e está em análise pelo administrador.'
                        : isSubmitting || uploadFile.isPending || submitScript.isPending
                          ? 'Enviando roteiro...'
                          : 'Enviar roteiro para validação'}
                    </button>
                  </form>
                </div>
              )}

              {/* Formulário Etapa 3 — Prova */}
              {!hasPassedStep2 && isProofStepCurrent && (
                <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ backgroundColor: surfaceBg, border: surfaceBorder }}>
                  <form onSubmit={handleSendProof} className="flex flex-col gap-4">
                    {submissionStatus !== 'proof_pending' && (
                      <>
                      <div>
                        <Label htmlFor="proof-link" style={{ color: bodyMuted, fontSize: 12 }}>Link da prova</Label>
                        <Input
                          id="proof-link"
                          type="url"
                          value={proofLink}
                          onChange={(e) => setProofLink(e.target.value)}
                          placeholder="Cole o link do vídeo (Google Drive, YouTube, etc.)"
                          className={`mt-1.5 h-[46px] ${inputCls}`}
                        />
                        <p style={{ fontSize: 11, color: faintColor, marginTop: 6, lineHeight: 1.45 }}>
                          Se for um vídeo no Google Drive, verifique se o link está público ou com acesso liberado para quem tem o link - assim a equipe consegue assistir sem pedir permissão.
                        </p>
                      </div>
                      <p style={{ fontSize: 12, color: bodyMuted, marginTop: 2 }}>E/ou anexe um arquivo da prova:</p>
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor="proof-file" style={{ color: bodyMuted, fontSize: 12 }}>Arquivo da prova</Label>
                          <span style={{ fontSize: 11, color: faintColor }}>Até {MAX_PROOF_FILES} arquivos</span>
                        </div>
                        <input
                          id="proof-file"
                          ref={proofFileInputRef}
                          type="file"
                          multiple
                          disabled={proofFiles.length >= MAX_PROOF_FILES}
                          onChange={handleProofFilesChange}
                          className={fileInputCls}
                        />
                        {proofFiles.length > 0 && (
                          <div className="flex flex-col gap-2 mt-2">
                            {proofFiles.map((file, i) => (
                              <div
                                key={`${file.name}-${file.size}-${file.lastModified}`}
                                className="flex items-center justify-between px-3 py-2 rounded-xl"
                                style={{ backgroundColor: 'rgba(var(--ink),0.04)', border: '1px solid rgba(var(--ink),0.08)' }}
                              >
                                <span style={{ fontSize: 12, color: bodyMuted }} className="truncate">{file.name}</span>
                                <button
                                  type="button"
                                  onClick={() => removeProofFile(i)}
                                  style={{ color: bulletColor, marginLeft: 8 }}
                                  className="hover:opacity-100 opacity-60 shrink-0"
                                  aria-label={`Remover ${file.name}`}
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      </>
                    )}
                    <button
                      type="submit"
                      disabled={submissionStatus === 'proof_pending' || isSubmitting || uploadFile.isPending || submitProof.isPending}
                      className={actionButtonClassName}
                      style={actionButtonStyle}
                    >
                      <Upload className="w-4 h-4 mr-2 shrink-0" />
                      {submissionStatus === 'proof_pending'
                        ? 'Sua prova foi enviada e está em análise pelo administrador.'
                        : isSubmitting || uploadFile.isPending || submitProof.isPending
                          ? 'Enviando prova...'
                          : 'Enviar prova para validação'}
                    </button>
                  </form>
                </div>
              )}

              {/* Formulário Etapa 4 — Métricas */}
              {isCampaignTask && hasPassedStep2 && !isMetricsCompleted && (
                <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ backgroundColor: surfaceBg, border: surfaceBorder }}>
                  <form onSubmit={handleSendMetrics} className="flex flex-col gap-4">
                    {metricsStatus !== 'pending' && (
                      <div>
                        <Label htmlFor="metrics-file" style={{ color: bodyMuted, fontSize: 12 }}>Arquivo de métricas (Obrigatório)</Label>
                        <input id="metrics-file" type="file" multiple onChange={(e) => setMetricsFiles(Array.from(e.target.files || []))} className="block w-full mt-1.5 text-sm file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold transition-all file:bg-[rgba(var(--ink),0.1)] file:text-[rgb(var(--ink))] hover:file:bg-[rgba(var(--ink),0.2)] file:cursor-pointer cursor-pointer text-[rgba(var(--ink),0.5)]" />
                      </div>
                    )}
                    <div title={metricsStatus === 'pending' ? undefined : (metricsButtonTitle || undefined)}>
                      <button
                        type="submit"
                        disabled={metricsStatus === 'pending' || isSubmitting || uploadFile.isPending || submitMetrics.isPending || !metricsFiles || metricsFiles.length === 0 || !canSubmitMetrics}
                        className={actionButtonClassName}
                        style={actionButtonStyle}
                      >
                        <Upload className="w-4 h-4 mr-2 shrink-0" />
                        {metricsStatus === 'pending'
                          ? 'Métricas enviadas. Em análise.'
                          : isSubmitting || uploadFile.isPending || submitMetrics.isPending
                            ? 'Enviando métricas...'
                            : 'Enviar métricas'}
                      </button>
                      {metricsStatus !== 'pending' && metricsInlineHint && (
                        <p style={{ fontSize: 11, color: softColor, marginTop: 8, textAlign: 'center' }}>
                          {metricsInlineHint}
                        </p>
                      )}
                    </div>
                  </form>
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

        </div>
      </DialogContent>
    </Dialog>
  );
}