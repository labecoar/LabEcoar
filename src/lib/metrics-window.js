import { addDays } from 'date-fns'

/** Em dev, defina VITE_DEV_SKIP_METRICS_WAIT=true no .env para liberar envio imediato */
const isDevMetricsBypass = import.meta.env.DEV && import.meta.env.VITE_DEV_SKIP_METRICS_WAIT === 'true'

/** Dias corridos após a aprovação da prova para liberar envio de métricas */
export const METRICS_WAIT_AFTER_PROOF_DAYS = isDevMetricsBypass ? 0 : 5

/** Dias corridos para reenvio após rejeição das métricas (liberado na hora; prazo máximo). */
export const METRICS_RESUBMISSION_WINDOW_DAYS = 5

/** Horário de abertura no quinto dia-calendário após a aprovação. */
export const METRICS_WINDOW_START_HOUR = 0
export const METRICS_WINDOW_START_MINUTE = 1

export const toDateOrNull = (value) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const resolveMetricsWindowStart = (baseDate) => {
  const start = addDays(baseDate, METRICS_WAIT_AFTER_PROOF_DAYS)
  start.setHours(METRICS_WINDOW_START_HOUR, METRICS_WINDOW_START_MINUTE, 0, 0)
  return start
}

/** Janela de envio: abre após METRICS_WAIT_AFTER_PROOF_DAYS; sem data final. */
export const getProofMetricsWindowFromSubmission = (submission) => {
  const proofApprovedAt = toDateOrNull(submission?.validated_at)
  const proofSubmittedAt = toDateOrNull(submission?.proof_submitted_at)
  const fallbackDate = toDateOrNull(submission?.updated_at)

  // A regra usa a aprovação. Datas de envio/atualização são apenas fallback
  // para registros legados que não possuem validated_at.
  const baseDate = proofApprovedAt || proofSubmittedAt || fallbackDate
  if (!baseDate) return { start: null, end: null, adminEnd: null }

  const start = resolveMetricsWindowStart(baseDate)

  return { start, end: null, adminEnd: null }
}

export const isInsideMetricsSubmissionWindow = (submission, now = new Date()) => {
  const { start, end } = getProofMetricsWindowFromSubmission(submission)
  if (!start) return false
  if (now < start) return false
  if (!end) return true
  return now.getTime() <= end.getTime()
}

/** @deprecated Prefer getProofMetricsWindowFromSubmission(submission) */
export const getProofApprovalMetricsWindow = (validatedAt, updatedAtFallback) => {
  if (validatedAt && typeof validatedAt === 'object' && !(validatedAt instanceof Date)) {
    return getProofMetricsWindowFromSubmission(validatedAt)
  }

  return getProofMetricsWindowFromSubmission({
    validated_at: validatedAt,
    updated_at: updatedAtFallback,
  })
}

export const getMetricsResubmissionDeadline = (reviewedAt) => {
  const reviewedDate = toDateOrNull(reviewedAt)
  if (!reviewedDate) return null

  return addDays(reviewedDate, METRICS_RESUBMISSION_WINDOW_DAYS)
}

export const isMetricsResubmissionOpen = (metricsSubmission, now = new Date()) => {
  if (String(metricsSubmission?.status || '').trim().toLowerCase() !== 'rejected') return false
  const deadline = getMetricsResubmissionDeadline(metricsSubmission?.reviewed_at)
  if (!deadline) return true
  return now.getTime() <= deadline.getTime()
}

export const canSubmitMetricsNow = ({
  task,
  submission,
  metricsSubmission,
  now = new Date(),
}) => {
  if (String(task?.category || '').trim().toLowerCase() !== 'campanha') return false

  const submissionStatus = String(submission?.status || '').trim().toLowerCase()
  if (submissionStatus !== 'approved') return false

  const metricsStatus = String(metricsSubmission?.status || '').trim().toLowerCase()
  if (metricsStatus === 'pending' || metricsStatus === 'approved') return false

  if (metricsStatus === 'rejected') {
    return isMetricsResubmissionOpen(metricsSubmission, now)
  }

  if (!metricsSubmission) {
    return isInsideMetricsSubmissionWindow(submission, now)
  }

  return false
}

/** Prazo máximo em que uma campanha permanece visível para o admin (prova no último dia). */
export const getCampaignAdminVisibilityDeadline = (taskExpiresAt) => {
  const expiresAt = toDateOrNull(taskExpiresAt)
  if (!expiresAt) return null

  return getProofMetricsWindowFromSubmission({
    proof_submitted_at: expiresAt.toISOString(),
    validated_at: expiresAt.toISOString(),
  }).adminEnd
}

export const isCampaignVisibleForAdminReview = (task) => {
  if (task?.category !== 'campanha') {
    return !task?.expires_at || new Date(task.expires_at).getTime() >= Date.now()
  }

  const adminDeadline = getCampaignAdminVisibilityDeadline(task?.expires_at)
  if (!adminDeadline) return true

  return Date.now() <= adminDeadline.getTime()
}
