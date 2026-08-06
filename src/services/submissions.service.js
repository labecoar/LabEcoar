import { supabase } from '@/lib/supabase'
import { storageService } from '@/services/storage.service'
import {
  resolveContentDeadline,
  resolveScriptDeadline,
  isApplicationOpen,
  isScriptSubmissionOpen,
  isContentSubmissionOpen,
} from '@/lib/campaign-deadlines'
import { isCampaignTask, requiresScriptApproval } from '@/lib/campaign-flow'

const APPROVAL_HISTORY_TABLE = 'submission_approval_history'

const isMissingApprovalHistoryTableError = (error) => {
  const raw = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase()
  return raw.includes('submission_approval_history') && (
    raw.includes('does not exist')
    || raw.includes('could not find')
    || raw.includes('schema cache')
  )
}

const toDateOrNull = (value) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const resolveProofDeadline = (task) => resolveContentDeadline(task)

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

async function getCurrentReviewerSnapshot() {
  const { data: authData } = await supabase.auth.getUser()
  const authUser = authData?.user || null
  if (!authUser?.id) {
    return {
      approverId: null,
      approverName: null,
      approverEmail: null,
    }
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('id, display_name, full_name, email')
    .eq('id', authUser.id)
    .maybeSingle()

  return {
    approverId: authUser.id,
    approverName: profileData?.display_name || profileData?.full_name || authUser.email || 'Admin',
    approverEmail: profileData?.email || authUser.email || null,
  }
}

async function registerApprovalHistoryEntry({ submission, task, action }) {
  if (!submission?.id || !task?.id || !action) return

  const reviewer = await getCurrentReviewerSnapshot()
  const insertPayload = {
    submission_id: submission.id,
    task_id: task.id,
    task_title: task.title || null,
    applicant_user_id: submission.user_id || null,
    action,
    approved_at: new Date().toISOString(),
    approver_id: reviewer.approverId,
    approver_name: reviewer.approverName,
    approver_email: reviewer.approverEmail,
  }

  const { error } = await supabase
    .from(APPROVAL_HISTORY_TABLE)
    .insert([insertPayload])

  if (!error) return
  if (isMissingApprovalHistoryTableError(error)) {
    console.warn('Tabela de histórico de aprovação ausente. Rode o SQL de migration para submission_approval_history.')
    return
  }

  throw error
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
        description,
        category,
        campaign_type,
        points,
        offered_value,
        expires_at,
        posting_deadline,
        delivery_deadline,
        launch_at,
        created_at,
        organization:organizations (
          id,
          name
        )
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
          campaign_type,
          points,
          offered_value,
          max_participants,
          current_participants,
          expires_at,
          posting_deadline,
          delivery_deadline,
          launch_at,
          created_at,
          requires_application,
          organization_id,
          organization:organizations (
            id,
            name
          )
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
        'script_pending',
        'script_approved',
        'script_rejected',
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
    return data || []
  },

  async getApprovalHistory(limit = 30) {
    const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(100, Number(limit))) : 30

    const { data, error } = await supabase
      .from(APPROVAL_HISTORY_TABLE)
      .select('*')
      .order('approved_at', { ascending: false })
      .limit(safeLimit)

    if (!error) return data || []
    if (isMissingApprovalHistoryTableError(error)) {
      return []
    }

    throw error
  },

  /**
   * Criar nova submissão
   */
  async createSubmission(submissionData) {
    const { data: taskRequirementRows, error: taskRequirementError } = await supabase
      .from('tasks')
      .select('id, min_followers, launch_at, created_at, category, campaign_type, organization_id, posting_deadline, expires_at')
      .eq('id', submissionData.task_id)
      .limit(1)

    if (taskRequirementError) throw taskRequirementError

    const taskDataForRequirement = taskRequirementRows?.[0] || null

    if (!taskDataForRequirement) {
      throw new Error('Tarefa nao encontrada para esta candidatura.')
    }

    const isSidequest = taskDataForRequirement.category === 'sidequest_teste'
    const initialStatus = isSidequest ? 'application_approved' : 'application_pending'
    const organizationId = taskDataForRequirement.organization_id || null

    const launchAt = taskDataForRequirement.launch_at ? new Date(taskDataForRequirement.launch_at) : null
    if (launchAt && !Number.isNaN(launchAt.getTime()) && launchAt.getTime() > Date.now()) {
      throw new Error('Esta tarefa ainda nao foi liberada. Aguarde o horario de lancamento.')
    }

    if (taskDataForRequirement.category === 'campanha' && !isApplicationOpen(taskDataForRequirement)) {
      throw new Error('O prazo para candidatura nesta campanha expirou.')
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
          status: initialStatus,
          description: submissionData.description || null,
          proof_url: null,
          script_url: null,
          script_description: null,
          script_submitted_at: null,
          points_awarded: 0,
          rejection_reason: null,
          validated_at: null,
          organization_id: organizationId,
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
      if (updatedSubmission && updatedSubmission.status === initialStatus) {
        return updatedSubmission
      }

      // Fallback: tenta upsert no par unico user_id/task_id para garantir o status pendente.
      const { error: upsertError } = await supabase
        .from('submissions')
        .upsert([
          {
            user_id: submissionData.user_id,
            task_id: submissionData.task_id,
            status: initialStatus,
            description: submissionData.description || null,
            proof_url: null,
            points_awarded: 0,
            rejection_reason: null,
            validated_at: null,
            organization_id: organizationId,
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
        status: initialStatus,
        organization_id: organizationId,
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
            status: initialStatus,
            description: submissionData.description || null,
            proof_url: null,
            points_awarded: 0,
            rejection_reason: null,
            validated_at: null,
            organization_id: organizationId,
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
        if (fallbackSubmission && fallbackSubmission.status === initialStatus) {
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
   * Enviar roteiro (campanha, após seleção)
   */
  async submitScript(submissionId, scriptData) {
    const { data: currentSubmission, error: currentSubmissionError } = await supabase
      .from('submissions')
      .select(`
        id,
        status,
        task_id
      `)
      .eq('id', submissionId)
      .single()

    if (currentSubmissionError) throw currentSubmissionError

    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .select('category, campaign_type, expires_at, posting_deadline, delivery_deadline, launch_at, created_at')
      .eq('id', currentSubmission.task_id)
      .single()

    if (taskError) throw taskError

    if (!requiresScriptApproval(taskData)) {
      throw new Error('Envio de roteiro disponível apenas para campanhas.')
    }

    const canSubmitScript = ['application_approved', 'script_rejected'].includes(currentSubmission.status)
    if (!canSubmitScript) {
      throw new Error('Esta submissão não está apta para envio de roteiro no momento.')
    }

    if (!isScriptSubmissionOpen(taskData)) {
      throw new Error('Prazo de envio do roteiro expirou para esta campanha.')
    }

    const { data, error } = await supabase
      .from('submissions')
      .update({
        status: 'script_pending',
        script_url: scriptData.script_url || null,
        script_description: scriptData.script_description || null,
        script_submitted_at: new Date().toISOString(),
        rejection_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .in('status', ['application_approved', 'script_rejected'])
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Enviar prova após aprovação da inscrição ou do roteiro
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
      .select('category, campaign_type, points, expires_at, posting_deadline, delivery_deadline, launch_at, created_at')
      .eq('id', currentSubmission.task_id)
      .single()

    if (taskError) throw taskError

    const isSidequestTest = String(taskData?.category || '') === 'sidequest_teste'
    const isCampaign = isCampaignTask(taskData)
    const requiresScript = requiresScriptApproval(taskData)
    const canSubmitProof = isSidequestTest
      ? ['application_pending', 'application_approved', 'rejected'].includes(currentSubmission.status)
      : requiresScript
        ? ['script_approved', 'rejected'].includes(currentSubmission.status)
        : ['application_approved', 'rejected'].includes(currentSubmission.status)

    if (!canSubmitProof) {
      throw new Error('Esta submissão não está apta para envio de prova no momento.')
    }

    if (isCampaign && !isContentSubmissionOpen(taskData)) {
      const scriptDeadline = resolveScriptDeadline(taskData)
      if (scriptDeadline && new Date() < scriptDeadline) {
        throw new Error('O envio de conteúdo libera na segunda metade do cronograma da campanha.')
      }
      throw new Error('Prazo de envio da prova expirou para esta tarefa.')
    }

    const proofDeadline = resolveProofDeadline(taskData)
    if (!isCampaign && proofDeadline && new Date() > proofDeadline) {
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
        proof_submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .in('status', isSidequestTest
        ? ['application_pending', 'application_approved', 'rejected']
        : requiresScript
          ? ['script_approved', 'rejected']
          : ['application_approved', 'rejected'])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async approveSubmission(submissionId, pointsAwarded) {
    const { data: currentSubmission, error: currentSubmissionError } = await supabase
      .from('submissions')
      .select('id, task_id, user_id, status')
      .eq('id', submissionId)
      .single()

    if (currentSubmissionError) throw currentSubmissionError

    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .select('id, title, category, campaign_type, current_participants, max_participants, expires_at, posting_deadline, delivery_deadline, launch_at, created_at')
      .eq('id', currentSubmission.task_id)
      .single()

    if (taskError) throw taskError

    // Validar limite de participantes APENAS ao aprovar candidatura (não ao aprovar prova)
    if (
      currentSubmission.status === 'application_pending'
      || currentSubmission.status === 'pending'
      || currentSubmission.status === 'application_rejected'
    ) {
      if (requiresScriptApproval(taskData) && !isScriptSubmissionOpen(taskData)) {
        throw new Error('O prazo de envio do roteiro já encerrou. Estenda o prazo da campanha antes de selecionar esta candidatura.')
      }
      if (isCampaignTask(taskData) && !requiresScriptApproval(taskData) && !isContentSubmissionOpen(taskData)) {
        throw new Error('O prazo de envio do conteúdo já encerrou. Estenda o prazo da campanha antes de selecionar esta candidatura.')
      }

      const currentParticipants = Number(taskData.current_participants || 0)
      const maxParticipants = taskData.max_participants == null ? null : Number(taskData.max_participants)
      if (maxParticipants !== null && currentParticipants >= maxParticipants) {
        throw new Error(`Limite de participantes atingido! Máximo: ${maxParticipants}, Atual: ${currentParticipants}`)
      }

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

      if (maxParticipants === null || currentParticipants < maxParticipants) {
        const { error: updateTaskError } = await supabase
          .from('tasks')
          .update({ current_participants: currentParticipants + 1, updated_at: new Date().toISOString() })
          .eq('id', currentSubmission.task_id)

        if (updateTaskError) throw updateTaskError
      }

      await registerApprovalHistoryEntry({
        submission: currentSubmission,
        task: taskData,
        action: 'application_approved',
      })

      return data
    }

    if (currentSubmission.status === 'script_pending') {
      const { data, error } = await supabase
        .from('submissions')
        .update({
          status: 'script_approved',
          validated_at: new Date().toISOString(),
          rejection_reason: null,
        })
        .eq('id', submissionId)
        .select()
        .single()

      if (error) throw error

      await registerApprovalHistoryEntry({
        submission: currentSubmission,
        task: taskData,
        action: 'script_approved',
      })

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

      await registerApprovalHistoryEntry({
        submission: currentSubmission,
        task: taskData,
        action: 'proof_approved',
      })

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
      : currentSubmission.status === 'script_pending'
        ? 'script_rejected'
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

    // Decrementar participantes se estava em análise ou aprovado
    if (['application_approved', 'application_pending', 'pending'].includes(currentSubmission.status)) {
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
