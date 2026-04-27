import { supabase } from '@/lib/supabase'

const toDateOrNull = (value) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const resolveTaskProofDeadline = (taskLike) => {
  if (!taskLike) return null

  if (taskLike.category === 'campanha') {
    const postingDeadline = toDateOrNull(taskLike.posting_deadline)
    if (postingDeadline) return postingDeadline
  }

  return toDateOrNull(taskLike.expires_at)
    || toDateOrNull(taskLike.posting_deadline)
    || toDateOrNull(taskLike.delivery_deadline)
    || null
}

const isAutoExpiredRejectionReason = (reason) => {
  const normalized = String(reason || '').trim().toLowerCase()
  if (!normalized) return false

  return normalized.includes('prazo de envio da prova expirou')
    || normalized.includes('vaga cancelada por inatividade')
    || normalized.includes('primeira tentativa de envio da prova')
}

async function reopenAutoExpiredSubmissionsIfDeadlineExtended(previousTask, updatedTask) {
  const previousDeadline = resolveTaskProofDeadline(previousTask)
  const nextDeadline = resolveTaskProofDeadline(updatedTask)

  if (!previousDeadline || !nextDeadline) return
  if (nextDeadline.getTime() <= previousDeadline.getTime()) return

  const { data: rejectedSubmissions, error: rejectedError } = await supabase
    .from('submissions')
    .select('id, rejection_reason')
    .eq('task_id', updatedTask.id)
    .in('status', ['application_rejected', 'rejected'])

  if (rejectedError) throw rejectedError

  const toReopenIds = (rejectedSubmissions || [])
    .filter((submission) => isAutoExpiredRejectionReason(submission?.rejection_reason))
    .map((submission) => submission.id)

  if (toReopenIds.length === 0) return

  const nowIso = new Date().toISOString()
  const { error: reopenError } = await supabase
    .from('submissions')
    .update({
      status: 'application_pending',
      rejection_reason: null,
      validated_at: null,
      updated_at: nowIso,
      points_awarded: 0,
    })
    .in('id', toReopenIds)

  if (reopenError) throw reopenError
}

async function reactivateTaskIfDeadlineReopened(updatedTask) {
  if (!updatedTask || updatedTask.status === 'active') return updatedTask

  const nextDeadline = resolveTaskProofDeadline(updatedTask)
  const isReopenedWindow = !nextDeadline || nextDeadline.getTime() > Date.now()
  if (!isReopenedWindow) return updatedTask

  const { data: reactivatedTask, error: reactivateError } = await supabase
    .from('tasks')
    .update({
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', updatedTask.id)
    .select()
    .single()

  if (reactivateError) throw reactivateError
  return reactivatedTask
}

/**
 * Serviço de Tarefas
 */
export const tasksService = {
  /**
   * Listar todas as tarefas ativas
   */
  async getActiveTasks() {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Listar todas as tarefas (Admin)
   */
  async getAllTasks() {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Buscar tarefa por ID
   */
  async getTaskById(taskId) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single()

    if (error) throw error
    return data
  },

  /**
   * Criar nova tarefa (Admin)
   */
  async createTask(taskData) {
    let mutablePayload = {
      ...taskData,
      status: 'active'
    }

    while (true) {
      const { data, error } = await supabase
        .from('tasks')
        .insert([mutablePayload])
        .select()
        .single()

      if (!error) return data

      const message = String(error.message || '')

      const postgresMissingColumn = message.match(/column\s+"([^"]+)"\s+of\s+relation\s+"tasks"\s+does\s+not\s+exist/i)
      const postgrestMissingColumn = message.match(/Could not find the '([^']+)' column of 'tasks'/i)
      const missingColumn = postgresMissingColumn?.[1] || postgrestMissingColumn?.[1]

      if (missingColumn && missingColumn in mutablePayload && missingColumn !== 'id') {
        delete mutablePayload[missingColumn]
        continue
      }

      throw error
    }
  },

  /**
   * Atualizar tarefa (Admin)
   */
  async updateTask(taskId, updates) {
    const { data: previousTask, error: previousTaskError } = await supabase
      .from('tasks')
      .select('id, status, category, expires_at, posting_deadline, delivery_deadline')
      .eq('id', taskId)
      .single()

    if (previousTaskError) throw previousTaskError

    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single()

    if (error) throw error

    await reopenAutoExpiredSubmissionsIfDeadlineExtended(previousTask, data)
    return reactivateTaskIfDeadlineReopened(data)
  },

  /**
   * Deletar tarefa (Admin)
   */
  async deleteTask(taskId) {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)

    if (error) throw error
  }
}
