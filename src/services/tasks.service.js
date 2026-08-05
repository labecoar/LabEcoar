import { supabase } from '@/lib/supabase'
import { shouldSendCampaignEmailOnCreate } from '@/lib/task-scheduling'
import { resolveContentDeadline } from '@/lib/campaign-deadlines'
import { isDevCampaignEmailDisabled } from '@/lib/dev-safety'

const toDateOrNull = (value) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const resolveTaskProofDeadline = (taskLike) => resolveContentDeadline(taskLike)

const AUTO_EXPIRE_REJECTION_REASONS = [
  'Prazo de envio da prova expirou. Vaga cancelada e devolvida ao pool.',
  'Prazo de envio do roteiro expirou. Vaga cancelada e devolvida ao pool.',
  'Prazo da campanha expirou aguardando aprovação do roteiro. Vaga cancelada e devolvida ao pool.',
]

async function reopenAutoExpiredSubmissionsIfDeadlineExtended(previousTask, updatedTask) {
  const previousDeadline = resolveTaskProofDeadline(previousTask)
  const nextDeadline = resolveTaskProofDeadline(updatedTask)

  if (!previousDeadline || !nextDeadline) return
  if (nextDeadline.getTime() <= previousDeadline.getTime()) return

  const { data: rejectedSubmissions, error: rejectedError } = await supabase
    .from('submissions')
    .select('id')
    .eq('task_id', updatedTask.id)
    .in('status', ['application_rejected', 'rejected'])
    .in('rejection_reason', AUTO_EXPIRE_REJECTION_REASONS)

  if (rejectedError) throw rejectedError

  const toReopenIds = (rejectedSubmissions || []).map((submission) => submission.id)

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
  if (updatedTask.status === 'inactive' || updatedTask.status === 'archived') return updatedTask

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
      .select(`
        *,
        organization:organizations (
          id,
          name
        )
      `)
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
      .select(`
        *,
        organization:organizations (
          id,
          name
        )
      `)
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
      .select(`
        *,
        organization:organizations (
          id,
          name
        )
      `)
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

    // Em dev, marca como "e-mail já enviado" antes do INSERT para bloquear
    // webhooks/cron do Supabase que disparam independente do frontend.
    if (isDevCampaignEmailDisabled() && mutablePayload.category === 'campanha') {
      mutablePayload.launch_email_sent = true
    }

    while (true) {
      const { data, error } = await supabase
        .from('tasks')
        .insert([mutablePayload])
        .select()
        .single()

      if (!error) {
        if (shouldSendCampaignEmailOnCreate(data) && !isDevCampaignEmailDisabled()) {
          supabase.functions.invoke('send-new-campaign-email', {
            body: { record: data },
          }).catch((invokeError) => {
            console.error('Erro ao enfileirar e-mails da nova campanha:', invokeError)
          })
        } else if (shouldSendCampaignEmailOnCreate(data) && isDevCampaignEmailDisabled()) {
          console.warn('[dev] E-mail de nova campanha suprimido (launch_email_sent=true, VITE_DEV_DISABLE_CAMPAIGN_EMAIL=true)')
        }
        return data
      }

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
  },

  /**
   * Inativar tarefa (Admin) — oculta dos usuários sem excluir
   */
  async deactivateTask(taskId) {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        status: 'inactive',
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Reativar tarefa (Admin)
   */
  async reactivateTask(taskId) {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .select()
      .single()

    if (error) throw error
    return data
  },
}
