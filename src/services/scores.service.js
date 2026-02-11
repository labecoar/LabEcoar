import { supabase } from '@/lib/supabase'

/**
 * Serviço de Pontuação
 */
export const scoresService = {
  /**
   * Obter pontuação do usuário
   */
  async getUserScore(userId) {
    const { data, error } = await supabase
      .from('user_scores')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    
    return data || {
      user_id: userId,
      total_points: 0,
      tasks_completed: 0
    }
  },

  /**
   * Adicionar pontos ao usuário
   */
  async addPoints(userId, points) {
    // Buscar pontuação atual
    const currentScore = await this.getUserScore(userId)

    // Atualizar ou criar
    const { data, error } = await supabase
      .from('user_scores')
      .upsert({
        user_id: userId,
        total_points: (currentScore.total_points || 0) + points,
        tasks_completed: (currentScore.tasks_completed || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Obter ranking geral
   */
  async getLeaderboard(limit = 100) {
    const { data, error } = await supabase
      .from('user_scores')
      .select(`
        *,
        profile:profiles (
          id,
          full_name,
          email,
          avatar_url
        )
      `)
      .order('total_points', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  }
}
