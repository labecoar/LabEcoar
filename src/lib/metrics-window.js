import { addDays } from 'date-fns'

/** Em dev, defina VITE_DEV_SKIP_METRICS_WAIT=true no .env para liberar envio imediato */
const isDevMetricsBypass = import.meta.env.DEV && import.meta.env.VITE_DEV_SKIP_METRICS_WAIT === 'true'

/** Dias corridos após o envio da prova para liberar envio de métricas */
export const METRICS_WAIT_AFTER_PROOF_DAYS = isDevMetricsBypass ? 0 : 5

/** Dias corridos que o ecoante tem para enviar métricas após a janela abrir */
export const METRICS_SUBMISSION_WINDOW_DAYS = 365

/** Dias corridos extras (só admin) para aprovar métricas após o prazo do ecoante */
export const METRICS_ADMIN_REVIEW_BUFFER_DAYS = 0

/** Dias corridos para reenvio após rejeição das métricas */
export const METRICS_RESUBMISSION_WINDOW_DAYS = 365

/** Horário fixo de abertura da janela de métricas (horário local do navegador). */
export const METRICS_WINDOW_START_HOUR = 8

export const toDateOrNull = (value) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const resolveMetricsWindowStart = (baseDate) => {
  const start = addDays(baseDate, METRICS_WAIT_AFTER_PROOF_DAYS)
  start.setHours(METRICS_WINDOW_START_HOUR, 0, 0, 0)
  return start
}

export const getProofMetricsWindowFromSubmission = (submission) => {
  const proofSubmittedAt = toDateOrNull(submission?.proof_submitted_at)
  const proofApprovedAt = toDateOrNull(submission?.validated_at)
  const fallbackDate = toDateOrNull(submission?.updated_at)

  const baseDate = proofSubmittedAt || proofApprovedAt || fallbackDate
  if (!baseDate) return { start: null, end: null, adminEnd: null }

  const start = resolveMetricsWindowStart(baseDate)
  const end = addDays(start, METRICS_SUBMISSION_WINDOW_DAYS)
  const adminEnd = addDays(end, METRICS_ADMIN_REVIEW_BUFFER_DAYS)

  return { start, end, adminEnd }
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
