import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { rewardsService } from '@/services/rewards.service'

export function useRewards() {
  return useQuery({
    queryKey: ['rewards'],
    queryFn: () => rewardsService.getActiveRewards(),
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
    mutationFn: (rewardId) => rewardsService.claimReward(rewardId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rewards'] })
      queryClient.invalidateQueries({ queryKey: ['reward-claims', userId] })
      queryClient.invalidateQueries({ queryKey: ['scores', userId] })
    },
  })
}
