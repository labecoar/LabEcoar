import { addBusinessDays } from 'date-fns'

export const METRICS_RESUBMISSION_WINDOW_DAYS = 2

export const toDateOrNull = (value) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const getProofApprovalMetricsWindow = (validatedAt) => {
  const approvalDate = toDateOrNull(validatedAt)
  if (!approvalDate) return { start: null, end: null }

  const start = new Date(approvalDate.getTime() + 24 * 60 * 60 * 1000)
  return {
    start,
    end: addBusinessDays(start, METRICS_RESUBMISSION_WINDOW_DAYS),
  }
}

export const getMetricsResubmissionDeadline = (reviewedAt) => {
  const reviewedDate = toDateOrNull(reviewedAt)
  if (!reviewedDate) return null

  return new Date(reviewedDate.getTime() + METRICS_RESUBMISSION_WINDOW_DAYS * 24 * 60 * 60 * 1000)
}