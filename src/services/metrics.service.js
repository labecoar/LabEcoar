import { supabase } from '@/lib/supabase'

const METRICS_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
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

    // TODO: Disparar criação de pagamento quando aprovar métricas.
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

  async submitMetricsSubmission({ user, task, metricsFileUrl, metricsLink, description }) {
    const trimmedLink = String(metricsLink || '').trim() || null
    const trimmedDescription = String(description || '').trim() || null

    const { data: existing, error: existingError } = await supabase
      .from('metrics_submissions')
      .select('id, status, attempt_number')
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
            description: trimmedDescription,
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

    const { data, error } = await supabase
      .from('metrics_submissions')
      .update({
        metrics_file_url: metricsFileUrl,
        metrics_link: trimmedLink,
        description: trimmedDescription,
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
