import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const toDateOrNull = (value) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const isTaskScheduled = (task, now = new Date()) => {
  const launchAt = toDateOrNull(task?.launch_at)
  if (!launchAt) return false
  return launchAt.getTime() > now.getTime()
}

export const isTaskLaunched = (task, now = new Date()) => !isTaskScheduled(task, now)

export const getTaskAvailabilityReference = (task) =>
  toDateOrNull(task?.launch_at) || toDateOrNull(task?.created_at)

export const formatLaunchDateTime = (value) => {
  const date = toDateOrNull(value)
  if (!date) return null
  return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

export const formatDateTimeLocalValue = (value) => {
  if (!value) return ''
  const date = toDateOrNull(value)
  if (!date) return ''
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export const shouldSendCampaignEmailOnCreate = (task, now = new Date()) => {
  if (task?.category !== 'campanha') return false
  if (task?.launch_email_sent) return false
  return isTaskLaunched(task, now)
}

export const shouldSendCampaignEmailOnLaunch = (task, now = new Date()) => {
  if (task?.category !== 'campanha') return false
  if (task?.launch_email_sent) return false
  if (task?.status !== 'active') return false
  return isTaskLaunched(task, now)
}
