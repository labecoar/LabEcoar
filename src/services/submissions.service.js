import { supabase } from '@/lib/supabase'
import { storageService } from '@/services/storage.service'

const toDateOrNull = (value) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const resolveProofDeadline = (task) => {
  if (task?.category === 'campanha') {
    const campaignPostingDeadline = toDateOrNull(task?.posting_deadline)
    if (campaignPostingDeadline) return campaignPostingDeadline
  }

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
        offered_value,
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
          offered_value,
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
      .in('status', [
        'application_pending',
        'application_approved',
        'application_rejected',
        'proof_pending',
        'approved',
        'rejected',
        'pending',
        // Compatibilidade com valores legados/localizados
        'pendente',
        'aprovada',
        'rejeitada',
      ])
      .order('created_at', { ascending: false })

    if (error) throw error
    return applyRulesToSubmissions(data || [])
  },

  /**
   * Criar nova submissão
   */
  async createSubmission(submissionData) {
    const { data: taskRequirementRows, error: taskRequirementError } = await supabase
      .from('tasks')
      .select('id, min_followers')
      .eq('id', submissionData.task_id)
      .limit(1)

    if (taskRequirementError) throw taskRequirementError

    const taskDataForRequirement = taskRequirementRows?.[0] || null
    if (!taskDataForRequirement) {
      throw new Error('Tarefa nao encontrada para esta candidatura.')
    }

    const minFollowersRequired = Number(taskDataForRequirement?.min_followers || 0)
    if (minFollowersRequired > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('id, followers_count')
        .eq('id', submissionData.user_id)
        .limit(1)

      if (profileError) throw profileError

      const profileData = profileRows?.[0] || null
      if (!profileData) {
        throw new Error('Perfil do usuario nao encontrado para candidatura.')
      }

      const userFollowers = Number(profileData?.followers_count || 0)
      if (userFollowers < minFollowersRequired) {
        throw new Error(`Esta tarefa exige no minimo ${minFollowersRequired} seguidores para inscricao.`)
      }
    }

    const { data: existingSubmissions, error: existingError } = await supabase
      .from('submissions')
      .select('id, status, created_at, updated_at')
      .eq('user_id', submissionData.user_id)
      .eq('task_id', submissionData.task_id)
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false })

    if (existingError) {
      throw existingError
    }

    const submissions = existingSubmissions || []
    const latestSubmission = submissions[0] || null
    const hasActiveSubmission = submissions.some((item) => !['application_rejected', 'rejected'].includes(item?.status))

    if (hasActiveSubmission) {
      throw new Error('Você já possui uma inscrição ativa para esta tarefa.')
    }

    if (latestSubmission && ['application_rejected', 'rejected'].includes(latestSubmission.status)) {
      const nowIso = new Date().toISOString()
      const { error } = await supabase
        .from('submissions')
        .update({
          status: 'application_pending',
          description: submissionData.description || null,
          proof_url: null,
          points_awarded: 0,
          rejection_reason: null,
          validated_at: null,
          updated_at: nowIso,
        })
        .eq('id', latestSubmission.id)

      if (error) throw error

      const { data: reloadedRows, error: reloadError } = await supabase
        .from('submissions')
        .select('id, user_id, task_id, status, description, proof_url, points_awarded, rejection_reason, validated_at, updated_at')
        .eq('id', latestSubmission.id)
        .limit(1)

      if (reloadError) throw reloadError

      const updatedSubmission = reloadedRows?.[0] || null
      if (updatedSubmission && updatedSubmission.status === 'application_pending') {
        return updatedSubmission
      }

      // Fallback: tenta upsert no par unico user_id/task_id para garantir o status pendente.
      const { error: upsertError } = await supabase
        .from('submissions')
        .upsert([
          {
            user_id: submissionData.user_id,
            task_id: submissionData.task_id,
            status: 'application_pending',
            description: submissionData.description || null,
            proof_url: null,
            points_awarded: 0,
            rejection_reason: null,
            validated_at: null,
            updated_at: nowIso,
          },
        ], { onConflict: 'user_id,task_id' })

      if (upsertError) throw upsertError

      const { data: ensuredRows, error: ensureError } = await supabase
        .from('submissions')
        .select('id, user_id, task_id, status, description, proof_url, points_awarded, rejection_reason, validated_at, updated_at')
        .eq('user_id', submissionData.user_id)
        .eq('task_id', submissionData.task_id)
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)

      if (ensureError) throw ensureError

      const ensuredSubmission = ensuredRows?.[0] || null
      if (ensuredSubmission && ensuredSubmission.status === 'application_pending') {
        return ensuredSubmission
      }

      throw new Error('Não foi possível atualizar a candidatura para pendente. Peça ao admin para reabrir análise da inscrição.')
    }

    const { data: insertedRows, error } = await supabase
      .from('submissions')
      .insert([{
        ...submissionData,
        status: 'application_pending'
      }])
      .select()

    if (error) {
      const message = String(error.message || '')
      if (message.toLowerCase().includes('violates check constraint') || message.toLowerCase().includes('submissions_status_check')) {
        throw new Error('Backend desatualizado: status do fluxo não foi migrado no Supabase. Rode o SQL de migration da tabela submissions.')
      }
      if (message.toLowerCase().includes('duplicate key value') || message.toLowerCase().includes('idx_submissions_user_task_unique')) {
        const nowIso = new Date().toISOString()
        const { error: fallbackError } = await supabase
          .from('submissions')
          .update({
            status: 'application_pending',
            description: submissionData.description || null,
            proof_url: null,
            points_awarded: 0,
            rejection_reason: null,
            validated_at: null,
            updated_at: nowIso,
          })
          .eq('user_id', submissionData.user_id)
          .eq('task_id', submissionData.task_id)
          .in('status', ['application_rejected', 'rejected'])

        if (fallbackError) throw fallbackError

        const { data: fallbackRows, error: fallbackReadError } = await supabase
          .from('submissions')
          .select('id, status, description, proof_url, points_awarded, rejection_reason, validated_at, updated_at')
          .eq('user_id', submissionData.user_id)
          .eq('task_id', submissionData.task_id)
          .order('updated_at', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)

        if (fallbackReadError) throw fallbackReadError

        const fallbackSubmission = fallbackRows?.[0] || null
        if (fallbackSubmission && fallbackSubmission.status === 'application_pending') {
          return fallbackSubmission
        }

        throw new Error('Não foi possível reabrir sua candidatura automaticamente. Peça ao admin para clicar em "Reabrir Análise".')
      }
      throw error
    }

    const insertedSubmission = insertedRows?.[0] || null
    if (!insertedSubmission) {
      throw new Error('Nao foi possivel criar a candidatura.')
    }

    return insertedSubmission
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
        proof_url
      `)
      .eq('id', submissionId)
      .single()

    if (currentSubmissionError) throw currentSubmissionError

    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .select('category, points, expires_at, posting_deadline, delivery_deadline')
      .eq('id', currentSubmission.task_id)
      .single()

    if (taskError) throw taskError

    const isSidequestTest = String(taskData?.category || '') === 'sidequest_teste'
    const canSubmitProof = isSidequestTest
      ? ['application_pending', 'application_approved', 'rejected'].includes(currentSubmission.status)
      : ['application_approved', 'rejected'].includes(currentSubmission.status)

    if (!canSubmitProof) {
      throw new Error('Esta submissão não está apta para envio de prova no momento.')
    }

    const proofDeadline = resolveProofDeadline(taskData)
    if (proofDeadline && new Date() > proofDeadline) {
      throw new Error('Prazo de envio da prova expirou para esta tarefa.')
    }

    const sidequestPoints = Math.max(0, Number(taskData?.points || 0))

    const { data, error } = await supabase
      .from('submissions')
      .update({
        status: 'proof_pending',
        description: proofData.description || null,
        proof_url: proofData.proof_url || null,
        points_awarded: 0,
        rejection_reason: null,
        validated_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .in('status', isSidequestTest
        ? ['application_pending', 'application_approved', 'rejected']
        : ['application_approved', 'rejected'])
      .select()
      .single()

    if (error) throw error

    const previousProofUrl = String(currentSubmission?.proof_url || '').trim()
    const nextProofUrl = String(data?.proof_url || '').trim()
    if (previousProofUrl && nextProofUrl && previousProofUrl !== nextProofUrl) {
      storageService.deleteByPublicUrl(previousProofUrl).catch((cleanupError) => {
        console.warn('Nao foi possivel limpar prova antiga:', cleanupError)
      })
    }

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
      .select('id, status, task_id')
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
