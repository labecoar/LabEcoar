import { supabase } from '@/lib/supabase'
import { storageService } from '@/services/storage.service'
import { getProofApprovalMetricsWindow, getMetricsResubmissionDeadline } from '@/lib/metrics-window'

const METRICS_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
}

const isMissingPostedAtColumnError = (error) => {
  const raw = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase()
  return raw.includes('posted_at') && (
    raw.includes('schema cache')
    || raw.includes('could not find')
    || raw.includes('column')
  )
}

export const metricsService = {
  async getUserMetricsSubmissions(userId) {
    const { data, error } = await supabase
      .from('metrics_submissions')
      .select(`
        *,
        task:tasks (
          id,
          title,
          category,
          posting_deadline,
          delivery_deadline,
          offered_value
        )
      `)
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async getAdminMetricsByStatus(status) {
    const { data, error } = await supabase
      .from('metrics_submissions')
      .select(`
        *,
        task:tasks (
          id,
          title,
          category,
          posting_deadline,
          offered_value,
          points
        ),
        profile:profiles (
          id,
          full_name,
          display_name,
          email,
          instagram_handle,
          avatar_url
        )
      `)
      .eq('status', status)
      .order('submitted_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async approveMetricsSubmission(metricsSubmissionId) {
    const { data: submissionForApproval, error: submissionError } = await supabase
      .from('metrics_submissions')
      .select(`
        id,
        user_id,
        task_id,
        quarter,
        status,
        task:tasks (
          category,
          offered_value,
          points
        )
      `)
      .eq('id', metricsSubmissionId)
      .single()

    if (submissionError) throw submissionError

    const { data, error } = await supabase
      .from('metrics_submissions')
      .update({
        status: METRICS_STATUS.APPROVED,
        reviewed_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq('id', metricsSubmissionId)
      .eq('status', METRICS_STATUS.PENDING)
      .select()
      .single()

    if (error) throw error

    const paymentAmount = Number(submissionForApproval?.task?.offered_value || 0)
    const isCampaignTask = submissionForApproval?.task?.category === 'campanha'
    const paymentPoints = isCampaignTask ? 0 : Number(submissionForApproval?.task?.points || 0)
    const currentQuarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)}-${new Date().getFullYear()}`

    const { error: paymentError } = await supabase
      .from('payments')
      .insert([
        {
          user_id: submissionForApproval.user_id,
          metrics_submission_id: submissionForApproval.id,
          quarter: submissionForApproval.quarter || currentQuarter,
          category: submissionForApproval?.task?.category || 'campanha',
          points: paymentPoints,
          amount: paymentAmount,
          status: 'pendente',
          payment_method: 'deposito_manual',
          notes: `Pagamento gerado automaticamente a partir da aprovação de métricas (${submissionForApproval.id}).`,
        },
      ])

    if (paymentError) throw paymentError

    return data
  },

  async rejectMetricsSubmission(metricsSubmissionId, rejectionReason) {
    if (!rejectionReason || !rejectionReason.trim()) {
      throw new Error('Motivo de rejeição é obrigatório.')
    }

    const { data, error } = await supabase
      .from('metrics_submissions')
      .update({
        status: METRICS_STATUS.REJECTED,
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejectionReason.trim(),
      })
      .eq('id', metricsSubmissionId)
      .eq('status', METRICS_STATUS.PENDING)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async submitMetricsSubmission({ user, task, metricsFileUrl, metricsFileUrls, metricsLink, description }) {
    // metricsFileUrls: optional array of uploaded file URLs (preferred)
    const trimmedLink = String(metricsLink || '').trim() || null
    const trimmedDescription = String(description || '').trim() || null

    if (task?.category !== 'campanha') {
      throw new Error('Métricas são permitidas apenas para campanhas.')
    }

    const { data: proofSubmission, error: proofSubmissionError } = await supabase
      .from('submissions')
      .select('id, status, validated_at, updated_at')
      .eq('user_id', user.id)
      .eq('task_id', task.id)
      .eq('status', 'approved')
      .maybeSingle()

    if (proofSubmissionError) throw proofSubmissionError

    const proofMetricsWindow = getProofApprovalMetricsWindow(proofSubmission?.validated_at || proofSubmission?.updated_at)
    const now = new Date()
    if (!proofMetricsWindow.start || !proofMetricsWindow.end) {
      throw new Error('A janela de envio de métricas ainda não foi liberada.')
    }

    if (now < proofMetricsWindow.start) {
      throw new Error('As métricas só podem ser enviadas 24 horas após a aprovação da prova.')
    }

    if (now > proofMetricsWindow.end) {
      throw new Error('A janela de envio de métricas foi encerrada.')
    }
    
    // Capture timestamp automatically at submission time (prevents date fraud)
    const postedAtDate = new Date()

    const postingDeadlineDate = task?.posting_deadline ? new Date(task.posting_deadline) : null
    const hasValidPostingDeadline = postingDeadlineDate && !Number.isNaN(postingDeadlineDate.getTime())
    const postedLate = hasValidPostingDeadline ? postedAtDate > postingDeadlineDate : false
    const latePostingNotice = postedLate
      ? '[SISTEMA] Postagem informada fora do prazo planejado. Aplicar análise com plano B da equipe.'
      : null
    const finalDescription = [trimmedDescription, latePostingNotice].filter(Boolean).join('\n\n') || null

    const { data: existing, error: existingError } = await supabase
      .from('metrics_submissions')
      .select('id, status, attempt_number, reviewed_at, metrics_file_url, metrics_file_urls')
      .eq('user_id', user.id)
      .eq('task_id', task.id)
      .maybeSingle()

    if (existingError) throw existingError

    if (!existing) {
      const insertPayload = {
        task_id: task.id,
        user_id: user.id,
        task_title: task.title,
        user_email: user.email,
        user_name: user.user_metadata?.full_name || user.user_metadata?.display_name || user.email,
        // keep single-file compatibility and also store array when provided
        metrics_file_url: (metricsFileUrls && metricsFileUrls.length) ? metricsFileUrls[0] : metricsFileUrl,
        metrics_file_urls: (metricsFileUrls && metricsFileUrls.length) ? metricsFileUrls : null,
        metrics_link: trimmedLink,
        description: finalDescription,
        posted_at: postedAtDate.toISOString(),
        status: METRICS_STATUS.PENDING,
        submitted_at: new Date().toISOString(),
        quarter: `Q${Math.ceil((new Date().getMonth() + 1) / 3)}-${new Date().getFullYear()}`,
        attempt_number: 1,
      }

      const { data, error } = await supabase
        .from('metrics_submissions')
        .insert([insertPayload])
        .select()
        .single()

      if (!error) return data
      if (!isMissingPostedAtColumnError(error)) throw error

      const { posted_at: _, ...legacyInsertPayload } = insertPayload
      const { data: legacyData, error: legacyError } = await supabase
        .from('metrics_submissions')
        .insert([legacyInsertPayload])
        .select()
        .single()

      if (legacyError) throw legacyError
      return legacyData
    }

    if (existing.status !== METRICS_STATUS.REJECTED) {
      throw new Error('As métricas já foram enviadas e estão em análise ou aprovadas.')
    }

    const reviewedAt = existing.reviewed_at ? new Date(existing.reviewed_at) : null
    const resubmissionDeadline = getMetricsResubmissionDeadline(reviewedAt)
    if (resubmissionDeadline) {
      if (new Date() > resubmissionDeadline) {
        throw new Error('Prazo de reenvio encerrado (2 dias após a rejeição). Você não receberá pontos nem pagamento para esta campanha.')
      }
    }

    const updatePayload = {
      metrics_file_url: (metricsFileUrls && metricsFileUrls.length) ? metricsFileUrls[0] : metricsFileUrl,
      metrics_file_urls: (metricsFileUrls && metricsFileUrls.length) ? metricsFileUrls : null,
      metrics_link: trimmedLink,
      description: finalDescription,
      posted_at: postedAtDate.toISOString(),
      status: METRICS_STATUS.PENDING,
      rejection_reason: null,
      submitted_at: new Date().toISOString(),
      reviewed_at: null,
      attempt_number: Number(existing.attempt_number || 1) + 1,
    }

    const { data, error } = await supabase
      .from('metrics_submissions')
      .update(updatePayload)
      .eq('id', existing.id)
      .select()
      .single()

    if (!error) return data
    if (!isMissingPostedAtColumnError(error)) throw error

    const { posted_at: _, ...legacyUpdatePayload } = updatePayload
    const { data: legacyData, error: legacyError } = await supabase
      .from('metrics_submissions')
      .update(legacyUpdatePayload)
      .eq('id', existing.id)
      .select()
      .single()

    if (legacyError) throw legacyError
    return legacyData
  },
}
