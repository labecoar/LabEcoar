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
    mutationFn: (rewardId) => rewardsService.claimReward(rewardId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rewards'] })
      queryClient.invalidateQueries({ queryKey: ['reward-claims', userId] })
      queryClient.invalidateQueries({ queryKey: ['scores', userId] })
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
