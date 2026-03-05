import { supabase } from '@/lib/supabase'

/**
 * Serviço de Submissões
 */
export const submissionsService = {
  /**
   * Buscar submissões do usuário
   */
  async getUserSubmissions(userId) {
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        *,
        task:tasks (
          id,
          title,
          category,
          points,
          description,
          proof_type,
          content_formats,
          offered_value,
          campaign_type,
          requires_application,
          max_participants,
          current_participants,
          min_followers,
          expires_at
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
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
          current_participants
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
    return data || []
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
    const { data, error } = await supabase
      .from('submissions')
      .update({
        status: 'proof_pending',
        description: proofData.description || null,
        proof_url: proofData.proof_url || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .eq('status', 'application_approved')
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

    if (currentSubmission.status === 'application_pending' || currentSubmission.status === 'pending') {
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
    return data
  },
}
