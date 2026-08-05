import { supabase } from '@/lib/supabase'
import { scoresService } from '@/services/scores.service'

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

  async getAdminRewards() {
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async createReward(payload, userId) {
    const dataToInsert = {
      ...payload,
      created_by: userId,
      quantity_claimed: 0,
      is_active: payload.is_active ?? true,
    }

    const { data, error } = await supabase
      .from('rewards')
      .insert([dataToInsert])
      .select('*')
      .single()

    if (error) throw error
    return data
  },

  async updateReward(rewardId, payload) {
    const { data, error } = await supabase
      .from('rewards')
      .update(payload)
      .eq('id', rewardId)
      .select('*')
      .single()

    if (error) throw error
    return data
  },

  async deleteReward(rewardId) {
    const { error } = await supabase
      .from('rewards')
      .delete()
      .eq('id', rewardId)

    if (error) throw error
    return true
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

  async claimReward(rewardId, userId, addressData) {
    if (!userId) {
      throw new Error('Usuário não autenticado.')
    }

    const [rewardResult, cumulativeScore] = await Promise.all([
      supabase
        .from('rewards')
        .select('id, points_required, is_active, title, quantity_available, quantity_claimed')
        .eq('id', rewardId)
        .maybeSingle(),
      scoresService.getUserScore(userId),
    ])

    if (rewardResult.error) throw rewardResult.error
    const reward = rewardResult.data
    if (!reward || !reward.is_active) {
      throw new Error('Recompensa não encontrada ou inativa.')
    }

    if (
      reward.quantity_available != null
      && Number(reward.quantity_claimed || 0) >= Number(reward.quantity_available || 0)
    ) {
      throw new Error('Recompensa esgotada.')
    }

    const requiredPoints = Number(reward.points_required || 0)
    const availablePoints = Number(cumulativeScore?.total_points || 0)

    if (availablePoints < requiredPoints) {
      throw new Error(
        `Pontos insuficientes para este resgate. Você tem ${availablePoints} pontos e precisa de ${requiredPoints}.`,
      )
    }

    const { data: userData } = await supabase
      .from('profiles')
      .select('email, full_name, display_name')
      .eq('id', userId)
      .maybeSingle()

    const { data: claimData, error: claimError } = await supabase
      .from('reward_claims')
      .insert({
        reward_id: rewardId,
        user_id: userId,
        reward_title: reward.title,
        user_email: userData?.email || '',
        user_name: userData?.display_name || userData?.full_name || '',
        points_spent: requiredPoints,
        status: 'pendente',
        claimed_at: new Date().toISOString(),
        cep: addressData?.cep || null,
        endereco: addressData?.endereco || null,
        numero: addressData?.numero || null,
        complemento: addressData?.complemento || null,
        bairro: addressData?.bairro || null,
        cidade: addressData?.cidade || null,
        estado: addressData?.estado || null,
      })
      .select('id')
      .single()

    if (claimError) {
      throw claimError
    }

    const newTotalPoints = availablePoints - requiredPoints

    const { error: updateError } = await supabase
      .from('user_scores')
      .update({ total_points: newTotalPoints, updated_at: new Date().toISOString() })
      .eq('user_id', userId)

    if (updateError) {
      await supabase.from('reward_claims').delete().eq('id', claimData.id)
      throw updateError
    }

    const { error: stockError } = await supabase
      .from('rewards')
      .update({
        quantity_claimed: Number(reward.quantity_claimed || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rewardId)

    if (stockError) {
      await supabase.from('reward_claims').delete().eq('id', claimData.id)
      await supabase
        .from('user_scores')
        .update({ total_points: availablePoints, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
      throw stockError
    }

    return claimData.id
  },

  async getAdminClaims() {
    const { data, error } = await supabase
      .from('reward_claims')
      .select('*')
      .order('claimed_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async updateClaimStatus(claimId, payload) {
    const { data, error } = await supabase
      .from('reward_claims')
      .update(payload)
      .eq('id', claimId)
      .select('*')
      .single()

    if (error) throw error
    return data
  },
}
