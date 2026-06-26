import { addDays } from 'date-fns'

/** Dias corridos após o envio da prova para liberar envio de métricas */
export const METRICS_WAIT_AFTER_PROOF_DAYS = 5

/** Dias corridos que o ecoante tem para enviar métricas após a janela abrir */
export const METRICS_SUBMISSION_WINDOW_DAYS = 3

/** Dias corridos extras (só admin) para aprovar métricas após o prazo do ecoante */
export const METRICS_ADMIN_REVIEW_BUFFER_DAYS = 3

/** Dias corridos para reenvio após rejeição das métricas */
export const METRICS_RESUBMISSION_WINDOW_DAYS = 2

export const toDateOrNull = (value) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const getProofMetricsWindowFromSubmission = (submission) => {
  const proofSubmittedAt = toDateOrNull(submission?.proof_submitted_at)
  const proofApprovedAt = toDateOrNull(submission?.validated_at)
  const fallbackDate = toDateOrNull(submission?.updated_at)

  const baseDate = proofSubmittedAt || proofApprovedAt || fallbackDate
  if (!baseDate) return { start: null, end: null, adminEnd: null }

  const start = addDays(baseDate, METRICS_WAIT_AFTER_PROOF_DAYS)
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
