import { supabase } from '@/lib/supabase'

export const paymentsService = {
  async getPaymentInfo(userId) {
    const { data, error } = await supabase
      .from('payment_info')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error
    return data || null
  },

  async upsertPaymentInfo(userId, payload) {
    const { data, error } = await supabase
      .from('payment_info')
      .upsert(
        {
          user_id: userId,
          ...payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single()

    if (error) throw error
    return data
  },

  async getMyPayments(userId) {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async getAdminPayments(status = 'all') {
    const applyStatusFilter = (queryBuilder) => {
      if (status && status !== 'all') {
        return queryBuilder.eq('status', status)
      }
      return queryBuilder
    }

    const fullQuery = applyStatusFilter(
      supabase
        .from('payments')
        .select(`
          *,
          profile:profiles (
            id,
            display_name,
            full_name,
            email,
            instagram_handle
          ),
          metrics_submission:metrics_submissions (
            id,
            task_title,
            submitted_at
          )
        `)
        .order('created_at', { ascending: false })
    )

    const { data, error } = await fullQuery
    if (!error) return data || []

    const rawError = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase()
    const missingRelation = rawError.includes('relationship') && rawError.includes('metrics_submissions')

    if (!missingRelation) throw error

    // Fallback para bancos sem FK explícita payments.metrics_submission_id -> metrics_submissions.id
    const fallbackQuery = applyStatusFilter(
      supabase
        .from('payments')
        .select(`
          *,
          profile:profiles (
            id,
            display_name,
            full_name,
            email,
            instagram_handle
          )
        `)
        .order('created_at', { ascending: false })
    )

    const { data: fallbackData, error: fallbackError } = await fallbackQuery
    if (fallbackError) throw fallbackError

    return fallbackData || []
  },

  async updatePaymentStatus({ paymentId, status, notes }) {
    if (!paymentId) throw new Error('Pagamento inválido para atualização de status.')
    if (!status) throw new Error('Status é obrigatório para atualizar pagamento.')

    const payload = {
      status,
      notes: String(notes || '').trim() || null,
      updated_at: new Date().toISOString(),
    }

    if (status === 'pago') {
      payload.paid_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('payments')
      .update(payload)
      .eq('id', paymentId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async registerManualPayment({ metricsSubmissionId, userId, quarter, notes }) {
    if (!metricsSubmissionId) {
      throw new Error('Submissão de métricas inválida para registrar pagamento.')
    }

    const updatePayload = {
      status: 'pago',
      paid_at: new Date().toISOString(),
      notes: String(notes || '').trim() || null,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('payments')
      .update(updatePayload)
      .eq('metrics_submission_id', metricsSubmissionId)
      .neq('status', 'pago')
      .select()
      .maybeSingle()

    if (error) throw error

    if (data) return data

    // Compatibilidade: pagamentos antigos sem metrics_submission_id.
    if (!userId || !quarter) {
      throw new Error('Pagamento já registrado ou não encontrado para esta submissão.')
    }

    const { data: legacyPayment, error: legacyLookupError } = await supabase
      .from('payments')
      .select('id')
      .eq('user_id', userId)
      .eq('quarter', quarter)
      .in('status', ['pendente', 'processando'])
      .is('metrics_submission_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (legacyLookupError) throw legacyLookupError

    if (!legacyPayment?.id) {
      throw new Error('Pagamento já registrado ou não encontrado para esta submissão.')
    }

    const { data: legacyUpdated, error: legacyUpdateError } = await supabase
      .from('payments')
      .update(updatePayload)
      .eq('id', legacyPayment.id)
      .select()
      .single()

    if (legacyUpdateError) throw legacyUpdateError

    return legacyUpdated
  },
}
