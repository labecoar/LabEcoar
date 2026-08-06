import { toDateOrNull } from '@/lib/task-scheduling'
import { isCampaignTask, isQuickResponseCampaign, requiresScriptApproval } from '@/lib/campaign-flow'

/** Dias antes do prazo do roteiro em que a candidatura encerra. */
export const CAMPAIGN_APPLICATION_DAYS_BEFORE_SCRIPT = 1

const ONE_DAY_MS = 24 * 60 * 60 * 1000

export const resolveCampaignWindowStart = (task) =>
  toDateOrNull(task?.launch_at) || toDateOrNull(task?.created_at)

/** Prazo final de envio do conteúdo (prova). */
export const resolveContentDeadline = (task) => {
  if (task?.category !== 'campanha') {
    return toDateOrNull(task?.expires_at)
      || toDateOrNull(task?.posting_deadline)
      || toDateOrNull(task?.delivery_deadline)
      || null
  }

  return toDateOrNull(task?.posting_deadline) || toDateOrNull(task?.expires_at)
}

/** Meio do período entre abertura e prazo final — fim da janela do roteiro. */
export const resolveScriptDeadline = (task) => {
  if (!requiresScriptApproval(task)) return null

  const start = resolveCampaignWindowStart(task)
  const end = resolveContentDeadline(task)
  if (!end) return null
  if (!start || end.getTime() <= start.getTime()) return end

  const startDay = new Date(start)
  const endDay = new Date(end)
  startDay.setHours(0, 0, 0, 0)
  endDay.setHours(0, 0, 0, 0)
  const calendarDaySpan = Math.max(0, Math.round((endDay.getTime() - startDay.getTime()) / ONE_DAY_MS))
  const midpointDayOffset = Math.floor(calendarDaySpan / 2)
  const deadline = new Date(startDay)
  deadline.setDate(deadline.getDate() + midpointDayOffset)
  deadline.setHours(end.getHours(), end.getMinutes(), end.getSeconds(), end.getMilliseconds())

  if (deadline.getTime() <= start.getTime()) return start
  if (deadline.getTime() >= end.getTime()) {
    const previousDay = new Date(end)
    previousDay.setDate(previousDay.getDate() - 1)
    return previousDay.getTime() > start.getTime() ? previousDay : start
  }
  return deadline
}

/** Candidatura encerra 1 dia antes do prazo do roteiro (mínimo: abertura da campanha). */
export const resolveApplicationDeadline = (task) => {
  if (!isCampaignTask(task)) {
    return resolveContentDeadline(task)
  }

  const phaseDeadline = isQuickResponseCampaign(task)
    ? resolveContentDeadline(task)
    : resolveScriptDeadline(task)
  const start = resolveCampaignWindowStart(task)
  if (!phaseDeadline) return resolveContentDeadline(task)

  const raw = new Date(
    phaseDeadline.getTime() - CAMPAIGN_APPLICATION_DAYS_BEFORE_SCRIPT * ONE_DAY_MS
  )
  if (start && raw.getTime() < start.getTime()) return start
  return raw
}

/** Alias legado — para campanhas, equivale ao prazo de conteúdo. */
export const resolveProofDeadline = (task) => resolveContentDeadline(task)

export const getCampaignDeadlines = (task) => ({
  windowStart: resolveCampaignWindowStart(task),
  applicationDeadline: resolveApplicationDeadline(task),
  scriptDeadline: resolveScriptDeadline(task),
  contentDeadline: resolveContentDeadline(task),
})

export const isPastDeadline = (deadline, now = new Date()) =>
  Boolean(deadline && now.getTime() > deadline.getTime())

export const isApplicationOpen = (task, now = new Date()) =>
  !isCampaignTask(task) || !isPastDeadline(resolveApplicationDeadline(task), now)

export const isScriptSubmissionOpen = (task, now = new Date()) =>
  !requiresScriptApproval(task) || !isPastDeadline(resolveScriptDeadline(task), now)

/** Conteúdo só libera na 2ª metade do cronograma (a partir do prazo do roteiro). */
export const isContentSubmissionOpen = (task, now = new Date()) => {
  if (!isCampaignTask(task)) {
    return !isPastDeadline(resolveContentDeadline(task), now)
  }

  if (!requiresScriptApproval(task)) {
    return !isPastDeadline(resolveContentDeadline(task), now)
  }

  const scriptDeadline = resolveScriptDeadline(task)
  const contentDeadline = resolveContentDeadline(task)
  if (!contentDeadline) return false
  if (scriptDeadline && now.getTime() < scriptDeadline.getTime()) return false
  return !isPastDeadline(contentDeadline, now)
}

export const resolvePhaseDeadline = (task, submissionStatus) => {
  if (!isCampaignTask(task)) {
    return resolveContentDeadline(task)
  }
  const status = String(submissionStatus || '').trim().toLowerCase()

  if (!requiresScriptApproval(task)) {
    return status === 'application_pending'
      ? resolveApplicationDeadline(task)
      : resolveContentDeadline(task)
  }

  if (['application_pending', 'application_approved', 'script_rejected'].includes(status)) {
    return resolveScriptDeadline(task) || resolveContentDeadline(task)
  }

  if (status === 'script_pending') {
    return resolveContentDeadline(task)
  }

  if (['script_approved', 'proof_pending', 'rejected'].includes(status)) {
    return resolveContentDeadline(task)
  }

  return resolveContentDeadline(task)
}
