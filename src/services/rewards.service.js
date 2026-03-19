import { supabase } from '@/lib/supabase'

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

  async claimReward(rewardId) {
    const { data, error } = await supabase.rpc('claim_reward', { p_reward_id: rewardId })
    if (error) throw error
    return data
  },
}
