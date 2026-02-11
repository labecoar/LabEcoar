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
          points
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
          points
        ),
        profile:profiles (
          id,
          full_name,
          email
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  /**
   * Criar nova submissão
   */
  async createSubmission(submissionData) {
    const { data, error } = await supabase
      .from('submissions')
      .insert([{
        ...submissionData,
        status: 'pending'
      }])
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Aprovar submissão (Admin)
   */
  async approveSubmission(submissionId, pointsAwarded) {
    const { data, error } = await supabase
      .from('submissions')
      .update({
        status: 'approved',
        points_awarded: pointsAwarded,
        validated_at: new Date().toISOString()
      })
      .eq('id', submissionId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Rejeitar submissão (Admin)
   */
  async rejectSubmission(submissionId, rejectionReason) {
    const { data, error } = await supabase
      .from('submissions')
      .update({
        status: 'rejected',
        rejection_reason: rejectionReason,
        validated_at: new Date().toISOString()
      })
      .eq('id', submissionId)
      .select()
      .single()

    if (error) throw error
    return data
  }
}
