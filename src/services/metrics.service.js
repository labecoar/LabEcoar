import { supabase } from '@/lib/supabase'

const METRICS_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
}

const METRICS_RESUBMISSION_WINDOW_DAYS = 2

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

    const { data: paymentInfo, error: paymentInfoError } = await supabase
      .from('payment_info')
      .select('user_id, bank_name, agency, account_number, account_digit, full_name, cpf')
      .eq('user_id', submissionForApproval.user_id)
      .maybeSingle()

    if (paymentInfoError) throw paymentInfoError

    const hasCompletePaymentInfo = Boolean(
      paymentInfo
      && paymentInfo.bank_name
      && paymentInfo.agency
      && paymentInfo.account_number
      && paymentInfo.account_digit
      && paymentInfo.full_name
      && paymentInfo.cpf
    )

    if (!hasCompletePaymentInfo) {
      throw new Error('Dados bancários incompletos para depósito. Peça ao ecoante para atualizar em Meus Pagamentos.')
    }

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
    const paymentPoints = Number(submissionForApproval?.task?.points || 0)
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

  async submitMetricsSubmission({ user, task, metricsFileUrl, metricsLink, description, postedAt }) {
    const trimmedLink = String(metricsLink || '').trim() || null
    const trimmedDescription = String(description || '').trim() || null
    const trimmedPostedAt = String(postedAt || '').trim()

    if (!trimmedPostedAt) {
      throw new Error('Informe a data e hora em que a postagem foi publicada.')
    }

    const postedAtDate = new Date(trimmedPostedAt)
    if (Number.isNaN(postedAtDate.getTime())) {
      throw new Error('A data/hora de postagem informada é inválida.')
    }

    const postingDeadlineDate = task?.posting_deadline ? new Date(task.posting_deadline) : null
    const hasValidPostingDeadline = postingDeadlineDate && !Number.isNaN(postingDeadlineDate.getTime())
    const postedLate = hasValidPostingDeadline ? postedAtDate > postingDeadlineDate : false
    const latePostingNotice = postedLate
      ? '[SISTEMA] Postagem informada fora do prazo planejado. Aplicar análise com plano B da equipe.'
      : null
    const finalDescription = [trimmedDescription, latePostingNotice].filter(Boolean).join('\n\n') || null

    const { data: existing, error: existingError } = await supabase
      .from('metrics_submissions')
      .select('id, status, attempt_number, reviewed_at')
      .eq('user_id', user.id)
      .eq('task_id', task.id)
      .maybeSingle()

    if (existingError) throw existingError

    if (!existing) {
      const { data, error } = await supabase
        .from('metrics_submissions')
        .insert([
          {
            task_id: task.id,
            user_id: user.id,
            task_title: task.title,
            user_email: user.email,
            user_name: user.user_metadata?.full_name || user.user_metadata?.display_name || user.email,
            metrics_file_url: metricsFileUrl,
            metrics_link: trimmedLink,
            description: finalDescription,
            posted_at: postedAtDate.toISOString(),
            status: METRICS_STATUS.PENDING,
            submitted_at: new Date().toISOString(),
            quarter: `Q${Math.ceil((new Date().getMonth() + 1) / 3)}-${new Date().getFullYear()}`,
            attempt_number: 1,
          },
        ])
        .select()
        .single()

      if (error) throw error
      return data
    }

    if (existing.status !== METRICS_STATUS.REJECTED) {
      throw new Error('As métricas já foram enviadas e estão em análise ou aprovadas.')
    }

    const reviewedAt = existing.reviewed_at ? new Date(existing.reviewed_at) : null
    const hasValidReviewedAt = reviewedAt && !Number.isNaN(reviewedAt.getTime())
    if (hasValidReviewedAt) {
      const resubmissionDeadline = new Date(reviewedAt)
      resubmissionDeadline.setDate(resubmissionDeadline.getDate() + METRICS_RESUBMISSION_WINDOW_DAYS)
      if (new Date() > resubmissionDeadline) {
        throw new Error('Prazo de reenvio encerrado (2 dias após a rejeição). Você não receberá pontos nem pagamento para esta campanha.')
      }
    }

    const { data, error } = await supabase
      .from('metrics_submissions')
      .update({
        metrics_file_url: metricsFileUrl,
        metrics_link: trimmedLink,
        description: finalDescription,
        posted_at: postedAtDate.toISOString(),
        status: METRICS_STATUS.PENDING,
        rejection_reason: null,
        submitted_at: new Date().toISOString(),
        reviewed_at: null,
        attempt_number: Number(existing.attempt_number || 1) + 1,
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) throw error
    return data
  },
}
