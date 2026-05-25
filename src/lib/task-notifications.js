import { differenceInCalendarDays, startOfDay } from 'date-fns'
import { getProofApprovalMetricsWindow, getMetricsResubmissionDeadline } from '@/lib/metrics-window'

const normalizeSubmissionStatus = (status) => {
  if (!status) return null

  const normalized = String(status).trim().toLowerCase()
  if (normalized === 'pendente') return 'pending'
  if (normalized === 'aprovada' || normalized === 'aprovado' || normalized === 'concluida' || normalized === 'concluído') return 'approved'
  if (normalized === 'rejeitada' || normalized === 'rejeitado') return 'rejected'
  if (normalized === 'em_analise' || normalized === 'em análise') return 'proof_pending'

  return normalized
}

const toDateOrNull = (value) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const isBusinessDay = (date) => {
  if (!date) return false
  const weekDay = date.getDay()
  return weekDay !== 0 && weekDay !== 6
}

const resolveProofDeadline = (task) => {
  if (task?.category === 'campanha') {
    const campaignPostingDeadline = toDateOrNull(task?.posting_deadline)
    if (campaignPostingDeadline) return campaignPostingDeadline
  }

  return toDateOrNull(task?.expires_at)
    || toDateOrNull(task?.posting_deadline)
    || toDateOrNull(task?.delivery_deadline)
    || null
}

const buildHumanDayLabel = (deadlineDate, nowDate) => {
  const diffDays = differenceInCalendarDays(startOfDay(deadlineDate), startOfDay(nowDate))

  if (diffDays === 0) return 'hoje'
  if (diffDays === 1) return 'amanhã'
  return null
}

const getUserFollowers = (profile) => Number(profile?.followers_count || 0)

const getSubmissionForTask = (submissions, taskId) => {
  return (submissions || []).find((submission) => String(submission?.task_id || submission?.task?.id || submission?.taskId || '') === String(taskId)) || null
}

const getMetricsForTask = (metricsSubmissions, taskId) => {
  return (metricsSubmissions || []).find((item) => String(item?.task_id || '') === String(taskId)) || null
}

const isTaskVisibleAndAvailable = (task, profile, submission) => {
  if (!task || task.status !== 'active') return false

  const submissionStatus = normalizeSubmissionStatus(submission?.status)
  if (['application_approved', 'proof_pending', 'approved'].includes(submissionStatus)) return false

  if (task.max_participants && Number(task.current_participants || 0) >= Number(task.max_participants)) return false

  const minFollowers = Number(task.min_followers || 0)
  if (minFollowers > 0 && getUserFollowers(profile) < minFollowers) return false

  return true
}

const buildAvailableTaskNotification = ({ task, profile, submission, now }) => {
  if (submission) return null
  if (!isTaskVisibleAndAvailable(task, profile, submission)) return null

  return {
    id: `task-available-${task.id}`,
    type: 'task_available',
    title: 'Nova tarefa disponível',
    message: `A tarefa "${task.title}" já está disponível para você.`,
    related_task_id: task.id,
    related_task_title: task.title,
    created_date: task.updated_at || task.created_at || now.toISOString(),
  }
}

const buildProofDeadlineNotification = ({ task, submission, now }) => {
  const submissionStatus = normalizeSubmissionStatus(submission?.status)
  if (submissionStatus !== 'application_approved') return null

  const proofDeadline = resolveProofDeadline(task)
  if (!proofDeadline) return null

  const dayLabel = buildHumanDayLabel(proofDeadline, now)
  if (!dayLabel) return null

  return {
    id: `task-proof-${task.id}-${proofDeadline.toISOString().slice(0, 10)}`,
    type: 'task_due_soon',
    title: `Prazo da prova ${dayLabel}`,
    message: `Você tem até ${dayLabel} para enviar a prova da tarefa "${task.title}".`,
    related_task_id: task.id,
    related_task_title: task.title,
    created_date: proofDeadline.toISOString(),
  }
}

const buildMetricsDeadlineNotification = ({ task, submission, metricsSubmission, now }) => {
  if (task?.category !== 'campanha') return null

  const submissionStatus = normalizeSubmissionStatus(submission?.status)
  if (submissionStatus !== 'approved') return null

  const metricsStatus = normalizeSubmissionStatus(metricsSubmission?.status)
  if (metricsStatus === 'approved') return null

  const metricsWindow = getProofApprovalMetricsWindow(submission?.validated_at || submission?.updated_at)
  const reviewedAt = toDateOrNull(metricsSubmission?.reviewed_at)
  const deadlineSource = metricsStatus === 'rejected' && reviewedAt
    ? getMetricsResubmissionDeadline(reviewedAt)
    : metricsWindow.end

  if (!deadlineSource || Number.isNaN(deadlineSource.getTime())) return null
  if (now > deadlineSource) return null

  const dayLabel = buildHumanDayLabel(deadlineSource, now)
  if (!dayLabel) return null

  return {
    id: `task-metrics-${task.id}-${deadlineSource.toISOString().slice(0, 10)}`,
    type: 'task_metrics_due_soon',
    title: `Métricas ${dayLabel}`,
    message: `Você tem até ${dayLabel} para enviar as métricas da tarefa "${task.title}".`,
    related_task_id: task.id,
    related_task_title: task.title,
    created_date: deadlineSource.toISOString(),
  }
}

export const buildTaskNotifications = ({ tasks = [], submissions = [], metricsSubmissions = [], profile = null, now = new Date() }) => {
  const notifications = []

  for (const task of tasks) {
    const submission = getSubmissionForTask(submissions, task.id)
    const metricsSubmission = getMetricsForTask(metricsSubmissions, task.id)

    const availableNotification = buildAvailableTaskNotification({ task, profile, submission, now })
    if (availableNotification) notifications.push(availableNotification)

    const proofNotification = buildProofDeadlineNotification({ task, submission, now })
    if (proofNotification) notifications.push(proofNotification)

    const metricsNotification = buildMetricsDeadlineNotification({ task, submission, metricsSubmission, now })
    if (metricsNotification) notifications.push(metricsNotification)
  }

  return notifications.sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime())
}
