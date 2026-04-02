import { supabase } from '@/lib/supabase'
import { scoresService, getCurrentQuarterKey } from '@/services/scores.service'

export const rewardsService = {
  async getActiveRewards() {
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('is_active', true)
      .order('points_required', { ascending: false })

    if (error) throw error
    return data || []
  },

  async getMyClaims(userId) {
    const { data, error } = await supabase
      .from('reward_claims')
      .select('*')
      .eq('user_id', userId)
      .order('claimed_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async claimReward(rewardId, userId) {
    if (!userId) {
      throw new Error('Usuário não autenticado.')
    }

    const [reward, currentQuarterScore] = await Promise.all([
      supabase
        .from('rewards')
        .select('id, points_required, is_active')
        .eq('id', rewardId)
        .maybeSingle(),
      scoresService.getUserScore(userId, getCurrentQuarterKey()),
    ])

    if (reward.error) throw reward.error
    if (!reward.data || !reward.data.is_active) {
      throw new Error('Recompensa não encontrada ou inativa.')
    }

    const availablePoints = Number(currentQuarterScore?.total_points || 0)
    const requiredPoints = Number(reward.data.points_required || 0)
    if (availablePoints < requiredPoints) {
      throw new Error('Pontos insuficientes no trimestre atual para este resgate.')
    }

    const { data, error } = await supabase.rpc('claim_reward', { p_reward_id: rewardId })
    if (error) throw error
    return data
  },
}
