import { getProofMetricsWindowFromSubmission, getMetricsResubmissionDeadline } from '@/lib/metrics-window';
import { C } from '@/lib/theme';
import {
  resolveApplicationDeadline,
  resolveContentDeadline,
  resolveProofDeadline,
  resolveScriptDeadline,
  resolvePhaseDeadline,
  isPastDeadline,
} from '@/lib/campaign-deadlines';
import { getTaskDisplayCategory, isCampaignTask, requiresScriptApproval } from '@/lib/campaign-flow';

export { resolveProofDeadline };

export const CATEGORY_ACCENT = {
  campanha: C.lime,
  resposta_rapida: C.red,
  oficina: C.purple,
  folhetim: C.cyan,
  compartilhar_ecoante: C.pink,
  sidequest_teste: C.orange,
};

export const CATEGORY_ACCENT_BG = {
  campanha: C.lime_back,
  resposta_rapida: C.red_back,
  sidequest_teste: C.orange_back,
};

export const getCategoryStyle = (category) => ({
  color: CATEGORY_ACCENT[category] || C.blue,
  bg: CATEGORY_ACCENT_BG[category] || C.blue_back,
});

export const getSubmissionTaskDisplayCategory = (task) => getTaskDisplayCategory(task);

export const CATEGORY_ICONS = {
  campanha: 'Megaphone',
  resposta_rapida: 'Zap',
  oficina: 'BookOpen',
  folhetim: 'Share2',
  compartilhar_ecoante: 'Users',
  sidequest_teste: 'Target',
};

export const CATEGORY_NAMES = {
  campanha: 'Campanha',
  resposta_rapida: 'Resposta Rápida',
  oficina: 'Oficina',
  folhetim: 'Folhetim',
  compartilhar_ecoante: 'Compartilhar',
  sidequest_teste: 'Missão',
};

/** Categorias visíveis para ecoantes na plataforma */
export const ACTIVE_USER_CATEGORIES = {
  campanha: 'Campanha',
  resposta_rapida: 'Resposta Rápida',
  sidequest_teste: 'Missão',
};

/** Status detalhados — etapas dentro de "Em andamento". Concluída/Expirada ficam nas abas. */
export const USER_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Todas as etapas' },
  { value: 'inscricao_analise', label: 'Inscrição em análise' },
  { value: 'roteiro_rejeitado', label: 'Roteiro rejeitado' },
  { value: 'aguardando_roteiro', label: 'Aguardando roteiro' },
  { value: 'roteiro_analise', label: 'Roteiro em análise' },
  { value: 'aguardando_prova', label: 'Aguardando prova' },
  { value: 'aprovado_fazer', label: 'Aprovado p/ fazer' },
  { value: 'prova_analise', label: 'Prova em análise' },
  { value: 'rejeitada', label: 'Prova rejeitada' },
  { value: 'pendente_metricas', label: 'Pendente métricas' },
  { value: 'metricas_analise', label: 'Métricas em análise' },
  { value: 'reenviar_metricas', label: 'Reenviar métricas' },
];

export const USER_BUCKET_FILTER_OPTIONS = [
  { value: 'andamento', label: 'Em andamento' },
  { value: 'concluidas', label: 'Concluídas' },
  { value: 'expiradas', label: 'Expiradas' },
  { value: 'todas', label: 'Todas' },
];

export const normalizeSubmissionStatus = (status) => {
  if (!status) return null;
  const normalized = String(status).trim().toLowerCase();
  if (normalized === 'pendente') return 'pending';
  if (normalized === 'aprovada' || normalized === 'aprovado' || normalized === 'concluida' || normalized === 'concluído') return 'approved';
  if (normalized === 'rejeitada' || normalized === 'rejeitado') return 'rejected';
  if (normalized === 'em_analise' || normalized === 'em análise') return 'proof_pending';
  return normalized;
};

export const getSubmissionTaskId = (submission) =>
  submission?.task_id || submission?.task?.id || submission?.taskId || null;

export const toDateOrNull = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const isAutoExpiredSubmissionRejection = (submission) => {
  if (!submission) return false;
  const status = normalizeSubmissionStatus(submission.status);
  if (!['application_rejected', 'rejected'].includes(status)) return false;
  const reason = String(submission.rejection_reason || '').trim().toLowerCase();
  if (!reason) return false;
  return reason.includes('prazo de envio da prova expirou')
    || reason.includes('prazo de envio do roteiro expirou')
    || reason.includes('prazo da campanha expirou aguardando aprovação do roteiro')
    || reason.includes('vaga cancelada por inatividade')
    || reason.includes('primeira tentativa de envio da prova');
};

export const getDeadlineState = (expiresAtValue) => {
  if (!expiresAtValue) return { expiresAt: null, isExpired: false, isCritical: false, isWarning: false, timeLabel: 'Sem data' };
  const expiresAt = new Date(expiresAtValue);
  if (Number.isNaN(expiresAt.getTime())) return { expiresAt: null, isExpired: false, isCritical: false, isWarning: false, timeLabel: 'Data inválida' };
  const diffMs = expiresAt.getTime() - Date.now();
  const isExpired = diffMs <= 0;
  const oneDayMs = 24 * 60 * 60 * 1000;
  const threeDaysMs = 3 * oneDayMs;
  if (isExpired) return { expiresAt, isExpired: true, isCritical: false, isWarning: false, timeLabel: 'Expirada' };
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return {
    expiresAt,
    isExpired: false,
    isCritical: diffMs <= oneDayMs,
    isWarning: diffMs > oneDayMs && diffMs <= threeDaysMs,
    timeLabel: days > 0 ? `${days}d ${hours}h` : `${hours}h`,
  };
};

export const getTaskSteps = (task, submission) => {
  const steps = [];
  const isCampaign = isCampaignTask(task);
  const requiresScript = requiresScriptApproval(task);
  steps.push({
    label: 'Candidatar-se',
    date: isCampaign ? resolveApplicationDeadline(task) : (task?.posting_deadline || null),
  });
  if (requiresScript) {
    steps.push({ label: 'Enviar roteiro', date: resolveScriptDeadline(task) || task?.expires_at || null });
  }
  steps.push({
    label: 'Enviar conteúdo da tarefa',
    date: resolveContentDeadline(task) || task?.expires_at || null,
  });
  if (isCampaign) {
    const submissionStatus = normalizeSubmissionStatus(submission?.status);
    let metricsDate = null;
    if (submissionStatus === 'approved') {
      const window = getProofMetricsWindowFromSubmission(submission);
      metricsDate = window?.start || null;
    }
    steps.push({ label: 'Enviar métricas', date: metricsDate });
  }
  return steps;
};

export const getCompletedStepsCount = (task, submission, metricsSubmission) => {
  const submissionStatus = normalizeSubmissionStatus(submission?.status);
  const metricsStatus = String(metricsSubmission?.status || '').trim().toLowerCase();
  const requiresScript = requiresScriptApproval(task);
  let completed = 0;
  if (['application_approved', 'script_pending', 'script_approved', 'script_rejected', 'proof_pending', 'rejected', 'approved'].includes(submissionStatus)) completed++;
  if (requiresScript) {
    if (['script_pending', 'script_approved', 'proof_pending', 'rejected', 'approved'].includes(submissionStatus)) completed++;
  }
  if (['proof_pending', 'approved'].includes(submissionStatus)) completed++;
  if (task?.category === 'campanha' && metricsStatus === 'approved') completed++;
  return completed;
};

export const resolveNextDeadline = (task, submission, metricsSubmission) => {
  const submissionStatus = normalizeSubmissionStatus(submission?.status);
  const metricsStatus = String(metricsSubmission?.status || '').trim().toLowerCase();

  if (submissionStatus === 'approved' && task?.category === 'campanha') {
    if (metricsStatus === 'approved') return null;
    if (metricsStatus === 'rejected') {
      return toDateOrNull(getMetricsResubmissionDeadline(metricsSubmission?.reviewed_at));
    }
    return null;
  }

  if (['application_approved', 'application_pending', 'script_pending', 'script_approved', 'script_rejected', 'proof_pending', 'pending'].includes(submissionStatus)) {
    return resolvePhaseDeadline(task, submissionStatus);
  }

  return resolveContentDeadline(task);
};

// A extensão de prazo restaura a fase persistida em tasks.service.
// A UI nunca deve transformar uma rejeição antiga em nova candidatura por conta própria.
export const isSubmissionReopenedByDateChange = () => false;

export const shouldShowExpiredStatus = (task, submission) => {
  if (!isAutoExpiredSubmissionRejection(submission)) return false;
  const reason = String(submission?.rejection_reason || '').toLowerCase();
  const phaseDeadline = reason.includes('prazo de envio do roteiro')
    ? resolveScriptDeadline(task)
    : resolveContentDeadline(task);
  if (!phaseDeadline) return false;
  return Date.now() > phaseDeadline.getTime();
};

export const isCampaignWithPendingMetrics = (submission, metricsSubmission) => {
  const status = normalizeSubmissionStatus(submission?.status);
  const isCampaign = submission?.task?.category === 'campanha';
  if (!isCampaign || status !== 'approved') return false;
  const metricsStatus = String(metricsSubmission?.status || '').trim().toLowerCase();
  return metricsStatus !== 'approved';
};

export const isExpiredSubmission = (submission, metricsSubmission) => {
  const status = normalizeSubmissionStatus(submission?.status);
  const task = submission?.task;
  const taskCategory = task?.category;

  if (taskCategory === 'campanha' && status === 'approved') {
    const metricsStatus = String(metricsSubmission?.status || '').trim().toLowerCase();
    if (metricsStatus === 'approved') return false;

    const resubmissionDeadline = metricsStatus === 'rejected'
      ? toDateOrNull(getMetricsResubmissionDeadline(metricsSubmission?.reviewed_at))
      : null;
    if (!resubmissionDeadline) return false;
    return resubmissionDeadline.getTime() < Date.now();
  }

  if (shouldShowExpiredStatus(task, submission)) return true;

  const submissionStatus = normalizeSubmissionStatus(submission?.status);

  if (taskCategory === 'campanha') {
    if (requiresScriptApproval(task) && ['application_approved', 'script_rejected'].includes(submissionStatus)) {
      const scriptDeadline = resolveScriptDeadline(task);
      if (scriptDeadline && isPastDeadline(scriptDeadline)) return true;
    }
    if (
      ['script_approved', 'proof_pending', 'rejected'].includes(submissionStatus)
      || (!requiresScriptApproval(task) && submissionStatus === 'application_approved')
    ) {
      const contentDeadline = resolveContentDeadline(task);
      if (contentDeadline && isPastDeadline(contentDeadline)) return true;
    }
    if (submissionStatus === 'script_pending') {
      const contentDeadline = resolveContentDeadline(task);
      if (contentDeadline && isPastDeadline(contentDeadline)) return true;
    }
    if (submissionStatus === 'application_pending') {
      const applicationDeadline = resolveApplicationDeadline(task);
      if (applicationDeadline && isPastDeadline(applicationDeadline)) return true;
    }
    return false;
  }

  const expiresAt = resolveProofDeadline(task);
  if (!expiresAt) return false;

  const activeStatuses = ['application_pending', 'application_approved', 'script_pending', 'script_approved', 'script_rejected', 'proof_pending', 'pending', 'approved'];
  if (!activeStatuses.includes(status)) return false;
  if (status === 'approved' && taskCategory !== 'campanha') return false;

  return expiresAt.getTime() < Date.now();
};

export const isPendingSubmission = (submission, metricsSubmission) => {
  if (isExpiredSubmission(submission, metricsSubmission)) return false;
  const status = normalizeSubmissionStatus(submission?.status);
  return ['pending', 'application_pending', 'application_approved', 'application_rejected', 'script_pending', 'script_approved', 'script_rejected', 'proof_pending', 'rejected'].includes(status)
    || isCampaignWithPendingMetrics(submission, metricsSubmission);
};

export const isCompletedSubmission = (submission, metricsSubmission) => {
  if (isExpiredSubmission(submission, metricsSubmission)) return false;
  const status = normalizeSubmissionStatus(submission?.status);
  if (status !== 'approved') return false;
  return !isCampaignWithPendingMetrics(submission, metricsSubmission);
};

export const isRejectedSubmission = (submission, metricsSubmission) => {
  if (isExpiredSubmission(submission, metricsSubmission)) return false;
  const status = normalizeSubmissionStatus(submission?.status);
  if (isSubmissionReopenedByDateChange(submission?.task, submission)) return false;
  return ['application_rejected', 'rejected', 'script_rejected'].includes(status);
};

export const getUserSubmissionStatusDisplay = (submission, metricsSubmission) => {
  const task = submission?.task;
  const submissionStatus = normalizeSubmissionStatus(submission?.status);
  const metricsStatus = String(metricsSubmission?.status || '').trim().toLowerCase();

  if (isExpiredSubmission(submission, metricsSubmission)) {
    return { key: 'expirada', label: 'Expirada', bg: 'rgba(var(--ink),0.08)', color: `${C.cream}60`, bucket: 'expiradas' };
  }

  if (submissionStatus === 'approved') {
    if (task?.category === 'campanha') {
      if (metricsStatus === 'approved') {
        return { key: 'concluida', label: 'Concluída', bg: `${C.lime}18`, color: C.lime, bucket: 'concluidas' };
      }
      if (metricsStatus === 'pending') {
        return { key: 'metricas_analise', label: 'Métricas em análise', bg: 'rgba(68,102,255,0.12)', color: '#8899FF', bucket: 'andamento' };
      }
      if (metricsStatus === 'rejected') {
        return { key: 'reenviar_metricas', label: 'Reenviar métricas', bg: `${C.orange}18`, color: C.orange, bucket: 'andamento' };
      }
      return { key: 'pendente_metricas', label: 'Pendente métricas', bg: `${C.purple}18`, color: C.purple, bucket: 'andamento' };
    }
    return { key: 'concluida', label: 'Concluída', bg: `${C.lime}18`, color: C.lime, bucket: 'concluidas' };
  }

  if (shouldShowExpiredStatus(task, submission)) {
    return { key: 'expirada', label: 'Expirada', bg: 'rgba(var(--ink),0.08)', color: `${C.cream}60`, bucket: 'expiradas' };
  }
  if (submissionStatus === 'proof_pending') {
    return { key: 'prova_analise', label: 'Prova em análise', bg: `${C.purple}18`, color: C.purple, bucket: 'andamento' };
  }
  if (submissionStatus === 'script_pending') {
    return { key: 'roteiro_analise', label: 'Roteiro em análise', bg: `${C.blue}18`, color: C.blue, bucket: 'andamento' };
  }
  if (submissionStatus === 'script_approved') {
    return { key: 'aguardando_prova', label: 'Aguardando prova', bg: `${C.cyan}18`, color: C.cyan, bucket: 'andamento' };
  }
  if (submissionStatus === 'script_rejected') {
    return { key: 'roteiro_rejeitado', label: 'Roteiro rejeitado', bg: 'rgba(248,113,113,0.12)', color: '#f87171', bucket: 'andamento' };
  }
  if (submissionStatus === 'application_approved') {
    if (task?.category === 'campanha') {
      return requiresScriptApproval(task)
        ? { key: 'aguardando_roteiro', label: 'Aguardando roteiro', bg: `${C.cyan}18`, color: C.cyan, bucket: 'andamento' }
        : { key: 'aguardando_prova', label: 'Aguardando conteúdo', bg: `${C.cyan}18`, color: C.cyan, bucket: 'andamento' };
    }
    return { key: 'aprovado_fazer', label: 'Aprovado p/ fazer', bg: `${C.cyan}18`, color: C.cyan, bucket: 'andamento' };
  }
  if (['application_pending', 'pending'].includes(submissionStatus)) {
    const key = task?.category === 'sidequest_teste' ? 'aguardando_prova' : 'inscricao_analise';
    return {
      key,
      label: task?.category === 'sidequest_teste' ? 'Aguardando prova' : 'Inscrição em análise',
      bg: `${C.orange}18`,
      color: C.orange,
      bucket: 'andamento',
    };
  }
  if (['application_rejected', 'rejected'].includes(submissionStatus)) {
    if (isSubmissionReopenedByDateChange(task, submission)) {
      return { key: 'aguardando_prova', label: 'Aguardando prova', bg: `${C.orange}18`, color: C.orange, bucket: 'andamento' };
    }
    return { key: 'rejeitada', label: 'Rejeitada', bg: 'rgba(248,113,113,0.12)', color: '#f87171', bucket: 'andamento' };
  }

  return { key: 'em_andamento', label: 'Em andamento', bg: 'rgba(var(--ink),0.08)', color: `${C.cream}70`, bucket: 'andamento' };
};
