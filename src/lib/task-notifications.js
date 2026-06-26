import { differenceInCalendarDays, format, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { getProofMetricsWindowFromSubmission, getMetricsResubmissionDeadline } from '@/lib/metrics-window'
import { getTaskAvailabilityReference, isTaskLaunched } from '@/lib/task-scheduling'

export const PROOF_APPROACHING_DAYS = 3
export const METRICS_APPROACHING_DAYS = 3
export const NEW_TASK_MAX_AGE_DAYS = 30

export const normalizeSubmissionStatus = (status) => {
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

const resolveApplicationDeadline = (task) =>
  toDateOrNull(task?.expires_at)
  || toDateOrNull(task?.posting_deadline)
  || null

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

const formatDeadlineLabel = (date) =>
  format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })

const getDaysUntil = (deadlineDate, nowDate) =>
  differenceInCalendarDays(startOfDay(deadlineDate), startOfDay(nowDate))

const buildApproachingDayLabel = (deadlineDate, nowDate, maxDays = PROOF_APPROACHING_DAYS) => {
  const diffDays = getDaysUntil(deadlineDate, nowDate)
  if (diffDays < 0 || diffDays > maxDays) return null
  if (diffDays === 0) return 'hoje'
  if (diffDays === 1) return 'amanhã'
  return `em ${diffDays} dias`
}

const isExactlyOneDayBefore = (deadlineDate, nowDate) =>
  getDaysUntil(deadlineDate, nowDate) === 1

const getUserFollowers = (profile) => Number(profile?.followers_count || 0)

const getSubmissionForTask = (submissions, taskId) =>
  (submissions || []).find((submission) =>
    String(submission?.task_id || submission?.task?.id || submission?.taskId || '') === String(taskId)
  ) || null

const getMetricsForTask = (metricsSubmissions, taskId) =>
  (metricsSubmissions || []).find((item) => String(item?.task_id || '') === String(taskId)) || null

const isTaskVisibleAndAvailable = (task, profile, submission) => {
  if (!task || task.status !== 'active') return false
  if (!isTaskLaunched(task)) return false

  const submissionStatus = normalizeSubmissionStatus(submission?.status)
  if (['application_approved', 'proof_pending', 'approved'].includes(submissionStatus)) return false

  if (task.max_participants && Number(task.current_participants || 0) >= Number(task.max_participants)) return false

  const minFollowers = Number(task.min_followers || 0)
  if (minFollowers > 0 && getUserFollowers(profile) < minFollowers) return false

  return true
}

const isTaskRecentlyOpened = (task, now) => {
  const reference = getTaskAvailabilityReference(task) || toDateOrNull(task?.updated_at)
  if (!reference) return true
  if (!isTaskLaunched(task, now)) return false
  const ageDays = differenceInCalendarDays(startOfDay(now), startOfDay(reference))
  return ageDays <= NEW_TASK_MAX_AGE_DAYS
}

const baseNotification = ({ id, type, title, message, task, createdDate, linkPath = '/Tasks' }) => ({
  id,
  type,
  title,
  message,
  related_task_id: task?.id || null,
  related_task_title: task?.title || null,
  created_date: createdDate || new Date().toISOString(),
  link_path: linkPath,
})

const buildNewTaskNotification = ({ task, profile, submission, now }) => {
  if (submission) return null
  if (!isTaskVisibleAndAvailable(task, profile, submission)) return null
  if (!isTaskRecentlyOpened(task, now)) return null

  return baseNotification({
    id: `task-new-${task.id}`,
    type: 'task_available',
    title: 'Abriu tarefa nova',
    message: `A tarefa "${task.title}" acabou de abrir. Confira em Tarefas Disponíveis.`,
    task,
    createdDate: getTaskAvailabilityReference(task)?.toISOString() || task.created_at || task.updated_at || now.toISOString(),
  })
}

const buildApplicationStatusNotification = ({ task, submission }) => {
  if (!task || !submission) return null

  const status = normalizeSubmissionStatus(submission.status)

  if (status === 'application_approved') {
    return baseNotification({
      id: `candidatura-aprovada-${submission.id}`,
      type: 'candidatura_aprovada',
      title: 'Inscrição aceita',
      message: `Sua inscrição na tarefa "${task.title}" foi aceita!`,
      task,
      createdDate: submission.validated_at || submission.updated_at || submission.created_at,
      linkPath: '/MySubmissions',
    })
  }

  if (status === 'application_rejected') {
    return baseNotification({
      id: `candidatura-rejeitada-${submission.id}`,
      type: 'candidatura_rejeitada',
      title: 'Inscrição rejeitada',
      message: `Sua inscrição na tarefa "${task.title}" foi rejeitada.`,
      task,
      createdDate: submission.validated_at || submission.updated_at || submission.created_at,
      linkPath: '/MySubmissions',
    })
  }

  return null
}

const buildProofDeadlineNotification = ({ task, submission, now }) => {
  const submissionStatus = normalizeSubmissionStatus(submission?.status)
  if (submissionStatus !== 'application_approved') return null

  const proofDeadline = resolveProofDeadline(task)
  if (!proofDeadline || now > proofDeadline) return null

  const dayLabel = buildApproachingDayLabel(proofDeadline, now, PROOF_APPROACHING_DAYS)
  if (!dayLabel) return null

  return baseNotification({
    id: `task-proof-due-${task.id}-${proofDeadline.toISOString().slice(0, 10)}`,
    type: 'task_due_soon',
    title: 'Prazo da prova se aproximando',
    message: `Você está perto do prazo para enviar a prova da tarefa "${task.title}" (${dayLabel}).`,
    task,
    createdDate: proofDeadline.toISOString(),
    linkPath: '/MySubmissions',
  })
}

const buildProofStatusNotification = ({ task, submission, metricsSubmission }) => {
  if (!task || !submission) return null

  const status = normalizeSubmissionStatus(submission.status)
  const isCampaign = task.category === 'campanha'
  const metricsStatus = normalizeSubmissionStatus(metricsSubmission?.status)
  const isFullyComplete = isCampaign
    ? status === 'approved' && metricsStatus === 'approved'
    : status === 'approved'

  if (isFullyComplete) {
    return baseNotification({
      id: `task-completed-${submission.id}`,
      type: 'task_completed',
      title: 'Tarefa concluída',
      message: `Parabéns, você concluiu a tarefa "${task.title}"!`,
      task,
      createdDate: metricsSubmission?.reviewed_at || submission.validated_at || submission.updated_at,
      linkPath: '/MySubmissions',
    })
  }

  if (status === 'approved' && isCampaign && metricsStatus !== 'approved') {
    return baseNotification({
      id: `submissao-aprovada-${submission.id}`,
      type: 'submissao_aprovada',
      title: 'Prova aceita',
      message: `Sua prova da tarefa "${task.title}" foi aceita!`,
      task,
      createdDate: submission.validated_at || submission.updated_at,
      linkPath: '/MySubmissions',
    })
  }

  if (status === 'approved' && !isCampaign) {
    return null
  }

  if (status === 'rejected') {
    return baseNotification({
      id: `submissao-rejeitada-${submission.id}-${String(submission.updated_at || '').slice(0, 10)}`,
      type: 'submissao_rejeitada',
      title: 'Prova rejeitada',
      message: `Sua prova da tarefa "${task.title}" foi rejeitada.`,
      task,
      createdDate: submission.validated_at || submission.updated_at || submission.created_at,
      linkPath: '/MySubmissions',
    })
  }

  return null
}

const resolveMetricsDeadline = ({ submission, metricsSubmission }) => {
  const metricsStatus = normalizeSubmissionStatus(metricsSubmission?.status)
  const reviewedAt = toDateOrNull(metricsSubmission?.reviewed_at)

  if (metricsStatus === 'rejected' && reviewedAt) {
    return getMetricsResubmissionDeadline(reviewedAt)
  }

  const metricsWindow = getProofMetricsWindowFromSubmission(submission)
  return metricsWindow.end
}

const resolveAdminMetricsReviewDeadline = ({ submission, metricsSubmission }) => {
  const metricsStatus = normalizeSubmissionStatus(metricsSubmission?.status)
  if (metricsStatus !== 'pending') return null

  const metricsWindow = getProofMetricsWindowFromSubmission(submission)
  return metricsWindow.adminEnd
}

const buildMetricsSendReminderNotification = ({ task, submission, metricsSubmission, now }) => {
  if (task?.category !== 'campanha') return null

  const submissionStatus = normalizeSubmissionStatus(submission?.status)
  if (submissionStatus !== 'approved') return null

  const metricsStatus = normalizeSubmissionStatus(metricsSubmission?.status)
  if (metricsStatus === 'approved') return null

  const metricsWindow = getProofMetricsWindowFromSubmission(submission)
  if (!metricsWindow.start || now < metricsWindow.start) return null

  const deadline = resolveMetricsDeadline({ submission, metricsSubmission })
  if (!deadline || now > deadline) return null

  if (metricsStatus === 'pending') return null

  return baseNotification({
    id: `metrics-send-${task.id}-${deadline.toISOString().slice(0, 10)}`,
    type: 'metrics_send_reminder',
    title: 'Envie suas métricas',
    message: `Envie as métricas até ${formatDeadlineLabel(deadline)} para obter seu valor na campanha "${task.title}".`,
    task,
    createdDate: metricsWindow.start.toISOString(),
    linkPath: '/MySubmissions',
  })
}

const buildMetricsDeadlineNotification = ({ task, submission, metricsSubmission, now }) => {
  if (task?.category !== 'campanha') return null

  const submissionStatus = normalizeSubmissionStatus(submission?.status)
  if (submissionStatus !== 'approved') return null

  const metricsStatus = normalizeSubmissionStatus(metricsSubmission?.status)
  if (metricsStatus === 'approved') return null

  const deadline = resolveMetricsDeadline({ submission, metricsSubmission })
  if (!deadline || now > deadline) return null

  const dayLabel = buildApproachingDayLabel(deadline, now, METRICS_APPROACHING_DAYS)
  if (!dayLabel) return null

  return baseNotification({
    id: `task-metrics-due-${task.id}-${deadline.toISOString().slice(0, 10)}`,
    type: 'task_metrics_due_soon',
    title: 'Prazo das métricas se aproximando',
    message: `Você está perto do prazo para enviar as métricas da campanha "${task.title}" (${dayLabel}).`,
    task,
    createdDate: deadline.toISOString(),
    linkPath: '/MySubmissions',
  })
}

const isSidequestTask = (task) => String(task?.category || '') === 'sidequest_teste'

const requiresApplicationFlow = (task) =>
  Boolean(task?.requires_application) || task?.category === 'campanha'

export const buildTaskNotifications = ({
  tasks = [],
  submissions = [],
  metricsSubmissions = [],
  profile = null,
  now = new Date(),
}) => {

  if (profile?.is_active === false) return []

  const notifications = []
  const taskMap = new Map((tasks || []).map((task) => [String(task.id), task]))
  const seenIds = new Set()

  const pushUnique = (notification) => {
    if (!notification || seenIds.has(notification.id)) return
    seenIds.add(notification.id)
    notifications.push(notification)
  }

  for (const task of tasks) {
    const submission = getSubmissionForTask(submissions, task.id)
    const metricsSubmission = getMetricsForTask(metricsSubmissions, task.id)

    pushUnique(buildNewTaskNotification({ task, profile, submission, now }))
    pushUnique(buildProofDeadlineNotification({ task, submission, now }))
    pushUnique(buildMetricsSendReminderNotification({ task, submission, metricsSubmission, now }))
    pushUnique(buildMetricsDeadlineNotification({ task, submission, metricsSubmission, now }))
  }

  for (const submission of submissions) {
    const task = submission.task || taskMap.get(String(submission.task_id))
    if (!task) continue

    const metricsSubmission = getMetricsForTask(metricsSubmissions, task.id)

    pushUnique(buildApplicationStatusNotification({ task, submission }))
    pushUnique(buildProofStatusNotification({ task, submission, metricsSubmission }))
    pushUnique(buildProofDeadlineNotification({ task, submission, now }))
    pushUnique(buildMetricsSendReminderNotification({ task, submission, metricsSubmission, now }))
    pushUnique(buildMetricsDeadlineNotification({ task, submission, metricsSubmission, now }))
  }

  return notifications.sort(
    (a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime()
  )
}

export const buildAdminNotifications = ({
  tasks = [],
  pendingSubmissions = [],
  pendingMetricsSubmissions = [],
  now = new Date(),
}) => {
  const notifications = []
  const taskMap = new Map((tasks || []).map((task) => [String(task.id), task]))
  const dayKey = format(now, 'yyyy-MM-dd')

  const getTaskFromSubmission = (submission) =>
    submission.task || taskMap.get(String(submission.task_id))

  const pendingApplicationsByTask = new Map()
  const pendingProofsByTask = new Map()

  for (const submission of pendingSubmissions) {
    const task = getTaskFromSubmission(submission)
    if (!task || isSidequestTask(task)) continue

    const status = normalizeSubmissionStatus(submission.status)
    const taskId = String(task.id)

    if (['application_pending', 'pending'].includes(status)) {
      if (!pendingApplicationsByTask.has(taskId)) pendingApplicationsByTask.set(taskId, { task, count: 0 })
      pendingApplicationsByTask.get(taskId).count += 1
    }

    if (status === 'proof_pending') {
      if (!pendingProofsByTask.has(taskId)) pendingProofsByTask.set(taskId, { task, count: 0 })
      pendingProofsByTask.get(taskId).count += 1
    }
  }

  for (const { task, count } of pendingApplicationsByTask.values()) {
    if (!requiresApplicationFlow(task)) continue

    const deadline = resolveApplicationDeadline(task)
    if (!deadline || !isExactlyOneDayBefore(deadline, now)) continue

    notifications.push({
      id: `admin-application-review-${task.id}-${dayKey}`,
      type: 'admin_application_review_due',
      title: 'Candidaturas encerram amanhã',
      message: `Existem ${count} usuário${count === 1 ? '' : 's'} esperando pela aprovação de candidatura na tarefa "${task.title}".`,
      related_task_id: task.id,
      related_task_title: task.title,
      created_date: now.toISOString(),
      link_path: '/AdminApplications',
    })
  }

  for (const { task, count } of pendingProofsByTask.values()) {
    const deadline = resolveProofDeadline(task)
    if (!deadline || !isExactlyOneDayBefore(deadline, now)) continue

    notifications.push({
      id: `admin-proof-review-${task.id}-${dayKey}`,
      type: 'admin_proof_review_due',
      title: 'Provas encerram amanhã',
      message: `Existem ${count} usuário${count === 1 ? '' : 's'} esperando pela aprovação de prova na tarefa "${task.title}".`,
      related_task_id: task.id,
      related_task_title: task.title,
      created_date: now.toISOString(),
      link_path: '/AdminApproval',
    })
  }

  const pendingMetricsByTask = new Map()

  for (const metricsSubmission of pendingMetricsSubmissions) {
    const taskId = String(metricsSubmission.task_id || metricsSubmission.task?.id || '')
    if (!taskId) continue

    const task = metricsSubmission.task || taskMap.get(taskId)
    if (!task || task.category !== 'campanha') continue

    const proofSubmission = pendingSubmissions.find((submission) =>
      String(submission.user_id) === String(metricsSubmission.user_id)
      && String(submission.task_id) === taskId
      && normalizeSubmissionStatus(submission.status) === 'approved'
    )

    const deadline = resolveAdminMetricsReviewDeadline({
      submission: proofSubmission,
      metricsSubmission,
    })

    if (!deadline || !isExactlyOneDayBefore(deadline, now)) continue

    if (!pendingMetricsByTask.has(taskId)) {
      pendingMetricsByTask.set(taskId, { task, count: 0 })
    }
    pendingMetricsByTask.get(taskId).count += 1
  }

  for (const { task, count } of pendingMetricsByTask.values()) {
    notifications.push({
      id: `admin-metrics-review-${task.id}-${dayKey}`,
      type: 'admin_metrics_review_due',
      title: 'Prazo de revisão de métricas se aproximando',
      message: `Existem ${count} usuário${count === 1 ? '' : 's'} aguardando aprovação de métricas na campanha "${task.title}". Revise até amanhã.`,
      related_task_id: task.id,
      related_task_title: task.title,
      created_date: now.toISOString(),
      link_path: '/AdminMetrics',
    })
  }

  return notifications.sort(
    (a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime()
  )
}

export const buildAllNotifications = (params) => {
  const userNotifications = params.isAdmin
    ? []
    : buildTaskNotifications(params)

  const adminNotifications = params.isAdmin
    ? buildAdminNotifications({
      tasks: params.tasks,
      pendingSubmissions: params.pendingSubmissions,
      pendingMetricsSubmissions: params.pendingMetricsSubmissions,
      now: params.now,
    })
    : []

  return [...adminNotifications, ...userNotifications].sort(
    (a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime()
  )
}
