import { supabase } from '@/lib/supabase'

const toDateOrNull = (value) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const resolveProofDeadline = (task) => {
  const expiresAt = toDateOrNull(task?.expires_at)
  if (expiresAt) return expiresAt

  const postingDeadline = toDateOrNull(task?.posting_deadline)
  if (postingDeadline) return postingDeadline

  const deliveryDate = toDateOrNull(task?.delivery_deadline)
  if (!deliveryDate) return null

  // Fallback para bases antigas: deadline ao fim do dia informado.
  const endOfDay = new Date(deliveryDate)
  endOfDay.setHours(23, 59, 59, 999)
  return endOfDay
}

const FIRST_ATTEMPT_WINDOW_RATIO = 0.3

async function decrementTaskParticipants(taskId) {
  if (!taskId) return

  const { data: taskData, error: taskError } = await supabase
    .from('tasks')
    .select('id, current_participants')
    .eq('id', taskId)
    .single()

  if (taskError) throw taskError

  const currentParticipants = Number(taskData.current_participants || 0)
  const { error: updateTaskError } = await supabase
    .from('tasks')
    .update({
      current_participants: Math.max(0, currentParticipants - 1),
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskData.id)

  if (updateTaskError) throw updateTaskError
}

async function autoCancelApprovedSubmission(submission, reason) {
  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from('submissions')
    .update({
      status: 'application_rejected',
      rejection_reason: reason,
      validated_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', submission.id)
    .eq('status', 'application_approved')
    .select('*')
    .single()

  if (error) {
    // Quando outra ação alterou o status em paralelo, mantém o registro atual.
    if (String(error.code || '') === 'PGRST116') return submission
    throw error
  }

  await decrementTaskParticipants(submission.task_id)
  return {
    ...submission,
    ...data,
  }
}

async function applySubmissionTaskRules(submission) {
  if (submission?.status !== 'application_approved') return submission

  const proofDeadline = resolveProofDeadline(submission.task)
  if (!proofDeadline) return submission

  const referenceStart =
    toDateOrNull(submission.validated_at)
    || toDateOrNull(submission.updated_at)
    || toDateOrNull(submission.created_at)

  if (!referenceStart) return submission

  const now = new Date()
  const totalWindowMs = proofDeadline.getTime() - referenceStart.getTime()

  if (totalWindowMs > 0) {
    const firstAttemptLimit = new Date(referenceStart.getTime() + (totalWindowMs * FIRST_ATTEMPT_WINDOW_RATIO))
    if (now > firstAttemptLimit) {
      return autoCancelApprovedSubmission(
        submission,
        'Vaga cancelada por inatividade: a primeira tentativa de envio da prova não ocorreu em 30% do prazo disponível.'
      )
    }
  }

  if (now > proofDeadline) {
    return autoCancelApprovedSubmission(
      submission,
      'Prazo de envio da prova expirou. Vaga cancelada e devolvida ao pool.'
    )
  }

  return submission
}

async function applyRulesToSubmissions(submissions) {
  return Promise.all((submissions || []).map((item) => applySubmissionTaskRules(item)))
}

/**
 * Serviço de Submissões
 */
export const submissionsService = {
  /**
   * Buscar submissões do usuário
   */
  async getUserSubmissions(userId) {
    const baseSelect = `
      *,
      task:tasks (
        id,
        title,
        category,
        points,
        expires_at,
        posting_deadline,
        delivery_deadline
      )
    `

    const { data, error } = await supabase
      .from('submissions')
      .select(baseSelect)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return applyRulesToSubmissions(data || [])
  },

  /**
   * Buscar submissões pendentes (Admin)
   */
  async getPendingSubmissions() {
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        *,
        task:tasks (
          id,
          title,
          category,
          points,
          max_participants,
          current_participants,
          expires_at,
          posting_deadline,
          delivery_deadline
        ),
        profile:profiles (
          id,
          display_name,
          full_name,
          email,
          avatar_url,
          instagram_handle,
          followers_count
        )
      `)
      .in('status', ['application_pending', 'application_approved', 'application_rejected', 'proof_pending', 'pending'])
      .order('created_at', { ascending: false })

    if (error) throw error
    return applyRulesToSubmissions(data || [])
  },

  /**
   * Criar nova submissão
   */
  async createSubmission(submissionData) {
    const { data: existingSubmission, error: existingError } = await supabase
      .from('submissions')
      .select('id, status')
      .eq('user_id', submissionData.user_id)
      .eq('task_id', submissionData.task_id)
      .maybeSingle()

    if (existingError) {
      const message = String(existingError.message || '')
      if (message.toLowerCase().includes('multiple') || message.toLowerCase().includes('more than one')) {
        throw new Error('Há múltiplas submissões antigas para esta tarefa. Avise o admin para limpar duplicidades no banco.')
      }
      throw existingError
    }

    if (existingSubmission && !['application_rejected', 'rejected'].includes(existingSubmission.status)) {
      throw new Error('Você já possui uma inscrição ativa para esta tarefa.')
    }

    if (existingSubmission && ['application_rejected', 'rejected'].includes(existingSubmission.status)) {
      const { data, error } = await supabase
        .from('submissions')
        .update({
          status: 'application_pending',
          description: submissionData.description || null,
          proof_url: null,
          points_awarded: 0,
          rejection_reason: null,
          validated_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSubmission.id)
        .select()
        .single()

      if (error) throw error
      return data
    }

    const { data, error } = await supabase
      .from('submissions')
      .insert([{
        ...submissionData,
        status: 'application_pending'
      }])
      .select()
      .single()

    if (error) {
      const message = String(error.message || '')
      if (message.toLowerCase().includes('violates check constraint') || message.toLowerCase().includes('submissions_status_check')) {
        throw new Error('Backend desatualizado: status do fluxo não foi migrado no Supabase. Rode o SQL de migration da tabela submissions.')
      }
      throw error
    }
    return data
  },

  /**
   * Aprovar submissão (Admin)
   */
  async submitProof(submissionId, proofData) {
    const { data: currentSubmission, error: currentSubmissionError } = await supabase
      .from('submissions')
      .select(`
        id,
        status,
        task_id,
        task:tasks (
          expires_at,
          posting_deadline,
          delivery_deadline
        )
      `)
      .eq('id', submissionId)
      .single()

    if (currentSubmissionError) throw currentSubmissionError

    if (!['application_approved', 'rejected'].includes(currentSubmission.status)) {
      throw new Error('Esta submissão não está apta para envio de prova no momento.')
    }

    const proofDeadline = resolveProofDeadline(currentSubmission.task)
    if (proofDeadline && new Date() > proofDeadline) {
      throw new Error('Prazo de envio da prova expirou para esta tarefa.')
    }

    const { data, error } = await supabase
      .from('submissions')
      .update({
        status: 'proof_pending',
        description: proofData.description || null,
        proof_url: proofData.proof_url || null,
        rejection_reason: null,
        validated_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .in('status', ['application_approved', 'rejected'])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async approveSubmission(submissionId, pointsAwarded) {
    const { data: currentSubmission, error: currentSubmissionError } = await supabase
      .from('submissions')
      .select('id, task_id, status')
      .eq('id', submissionId)
      .single()

    if (currentSubmissionError) throw currentSubmissionError

    if (
      currentSubmission.status === 'application_pending'
      || currentSubmission.status === 'pending'
      || currentSubmission.status === 'application_rejected'
    ) {
      const { data, error } = await supabase
        .from('submissions')
        .update({
          status: 'application_approved',
          validated_at: new Date().toISOString(),
          rejection_reason: null,
        })
        .eq('id', submissionId)
        .select()
        .single()

      if (error) throw error

      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('id, current_participants, max_participants')
        .eq('id', currentSubmission.task_id)
        .single()

      if (taskError) throw taskError

      const currentParticipants = Number(taskData.current_participants || 0)
      const maxParticipants = taskData.max_participants == null ? null : Number(taskData.max_participants)
      if (maxParticipants === null || currentParticipants < maxParticipants) {
        const { error: updateTaskError } = await supabase
          .from('tasks')
          .update({ current_participants: currentParticipants + 1, updated_at: new Date().toISOString() })
          .eq('id', currentSubmission.task_id)

        if (updateTaskError) throw updateTaskError
      }

      return data
    }

    if (currentSubmission.status === 'proof_pending') {
      const { data, error } = await supabase
        .from('submissions')
        .update({
          status: 'approved',
          points_awarded: pointsAwarded,
          validated_at: new Date().toISOString(),
          rejection_reason: null,
        })
        .eq('id', submissionId)
        .select()
        .single()

      if (error) throw error
      return data
    }

    throw new Error('Status da submissão não permite aprovação neste momento.')
  },

  /**
   * Rejeitar submissão (Admin)
   */
  async rejectSubmission(submissionId, rejectionReason) {
    const { data: currentSubmission, error: currentSubmissionError } = await supabase
      .from('submissions')
      .select('id, status')
      .eq('id', submissionId)
      .single()

    if (currentSubmissionError) throw currentSubmissionError

    const nextStatus = currentSubmission.status === 'proof_pending'
      ? 'rejected'
      : 'application_rejected'

    const { data, error } = await supabase
      .from('submissions')
      .update({
        status: nextStatus,
        rejection_reason: rejectionReason,
        validated_at: new Date().toISOString()
      })
      .eq('id', submissionId)
      .select()
      .single()

    if (error) throw error

    if (currentSubmission.status === 'application_approved') {
      await decrementTaskParticipants(currentSubmission.task_id)
    }

    return data
  },

  async resetSubmissionReview(submissionId) {
    const { data: currentSubmission, error: currentSubmissionError } = await supabase
      .from('submissions')
      .select('id, status, task_id')
      .eq('id', submissionId)
      .single()

    if (currentSubmissionError) throw currentSubmissionError

    const { data, error } = await supabase
      .from('submissions')
      .update({
        status: 'application_pending',
        rejection_reason: null,
        validated_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .select()
      .single()

    if (error) throw error

    if (currentSubmission.status === 'application_approved') {
      await decrementTaskParticipants(currentSubmission.task_id)
    }

    return data
  },
}
