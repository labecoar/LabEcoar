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
    // Começar pelo fallback (sem relação metrics_submission) já que a FK não existe ainda
    const selectFieldsFallback = '*,profile:profiles(id,display_name,full_name,email,instagram_handle)'

    const buildQuery = (selectStr) => {
      let q = supabase.from('payments').select(selectStr)
      if (status && status !== 'all') {
        q = q.eq('status', status)
      }
      return q.order('created_at', { ascending: false })
    }

    const fallbackQuery = buildQuery(selectFieldsFallback)
    const { data, error } = await fallbackQuery

    // Se funcionar sem a relação, retorna
    if (!error) return data || []

    // Se erro for por outro motivo, lança
    throw error
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
