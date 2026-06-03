import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { rewardsService } from '@/services/rewards.service'

export function useRewards() {
  return useQuery({
    queryKey: ['rewards'],
    queryFn: () => rewardsService.getActiveRewards(),
  })
}

export function useAdminRewards() {
  return useQuery({
    queryKey: ['rewards', 'admin'],
    queryFn: () => rewardsService.getAdminRewards(),
  })
}

export function useMyRewardClaims(userId) {
  return useQuery({
    queryKey: ['reward-claims', userId],
    queryFn: () => rewardsService.getMyClaims(userId),
    enabled: !!userId,
  })
}

export function useClaimReward(userId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload) => {
      // Aceita rewardId string (backwards compatibility) ou objeto com rewardId e address
      if (typeof payload === 'string') {
        return rewardsService.claimReward(payload, userId)
      }
      return rewardsService.claimReward(payload.rewardId, userId, payload.address)
    },
    onSuccess: () => {
      // Invalidar com padrão para pegar todas as variações
      queryClient.invalidateQueries({ queryKey: ['rewards'], refetchType: 'all' })
      queryClient.invalidateQueries({ queryKey: ['reward-claims'], refetchType: 'all' })
      queryClient.invalidateQueries({ queryKey: ['scores'], refetchType: 'all' })
      queryClient.invalidateQueries({ queryKey: ['leaderboard'], refetchType: 'all' })
    },
    onError: (error) => {
      // Erro será tratado pelo toast na página
    },
  })
}

export function useCreateReward(userId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload) => rewardsService.createReward(payload, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rewards'] })
      queryClient.invalidateQueries({ queryKey: ['rewards', 'admin'] })
    },
  })
}

export function useUpdateReward() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ rewardId, payload }) => rewardsService.updateReward(rewardId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rewards'] })
      queryClient.invalidateQueries({ queryKey: ['rewards', 'admin'] })
    },
  })
}

export function useDeleteReward() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (rewardId) => rewardsService.deleteReward(rewardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rewards'] })
      queryClient.invalidateQueries({ queryKey: ['rewards', 'admin'] })
    },
  })
}

export function useAdminRewardClaims() {
  return useQuery({
    queryKey: ['reward-claims', 'admin'],
    queryFn: () => rewardsService.getAdminClaims(),
  })
}

export function useUpdateRewardClaim() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ claimId, payload }) => rewardsService.updateClaimStatus(claimId, payload),
    onMutate: async ({ claimId, payload }) => {
      // Cancelar qualquer query em andamento
      await queryClient.cancelQueries({ queryKey: ['reward-claims', 'admin'] })

      // Snapshot dos dados antigos
      const previousData = queryClient.getQueryData(['reward-claims', 'admin'])

      // Atualizar cache otimisticamente
      queryClient.setQueryData(['reward-claims', 'admin'], (old) => {
        if (!old) return old
        return old.map((claim) =>
          claim.id === claimId
            ? { ...claim, ...payload }
            : claim
        )
      })

      return { previousData }
    },
    onError: (error, variables, context) => {
      // Reverter ao estado anterior em caso de erro
      if (context?.previousData) {
        queryClient.setQueryData(['reward-claims', 'admin'], context.previousData)
      }
    },
    onSuccess: () => {
      // Refetch para garantir sincronização
      queryClient.invalidateQueries({ queryKey: ['reward-claims', 'admin'] })
      queryClient.invalidateQueries({ queryKey: ['rewards', 'admin'] })
    },
  })
}
