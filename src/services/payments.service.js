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
}
