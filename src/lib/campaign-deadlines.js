import { toDateOrNull } from '@/lib/task-scheduling'

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
  if (task?.category !== 'campanha') return null

  const start = resolveCampaignWindowStart(task)
  const end = resolveContentDeadline(task)
  if (!end) return null
  if (!start || end.getTime() <= start.getTime()) return end

  return new Date(start.getTime() + (end.getTime() - start.getTime()) / 2)
}

/** Candidatura encerra 1 dia antes do prazo do roteiro (mínimo: abertura da campanha). */
export const resolveApplicationDeadline = (task) => {
  if (task?.category !== 'campanha') {
    return resolveContentDeadline(task)
  }

  const scriptDeadline = resolveScriptDeadline(task)
  const start = resolveCampaignWindowStart(task)
  if (!scriptDeadline) return resolveContentDeadline(task)

  const raw = new Date(
    scriptDeadline.getTime() - CAMPAIGN_APPLICATION_DAYS_BEFORE_SCRIPT * ONE_DAY_MS
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
  task?.category !== 'campanha' || !isPastDeadline(resolveApplicationDeadline(task), now)

export const isScriptSubmissionOpen = (task, now = new Date()) =>
  task?.category !== 'campanha' || !isPastDeadline(resolveScriptDeadline(task), now)

/** Conteúdo só libera na 2ª metade do cronograma (a partir do prazo do roteiro). */
export const isContentSubmissionOpen = (task, now = new Date()) => {
  if (task?.category !== 'campanha') {
    return !isPastDeadline(resolveContentDeadline(task), now)
  }

  const scriptDeadline = resolveScriptDeadline(task)
  const contentDeadline = resolveContentDeadline(task)
  if (!contentDeadline) return false
  if (scriptDeadline && now.getTime() < scriptDeadline.getTime()) return false
  return !isPastDeadline(contentDeadline, now)
}

export const resolvePhaseDeadline = (task, submissionStatus) => {
  if (task?.category !== 'campanha') {
    return resolveContentDeadline(task)
  }

  const status = String(submissionStatus || '').trim().toLowerCase()

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
