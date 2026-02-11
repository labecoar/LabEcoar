import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { scoresService } from '@/services/scores.service'

/**
 * Hook para buscar pontuação do usuário
 */
export function useUserScore(userId) {
  return useQuery({
    queryKey: ['scores', userId],
    queryFn: () => scoresService.getUserScore(userId),
    enabled: !!userId,
  })
}

/**
 * Hook para buscar ranking
 */
export function useLeaderboard(limit = 100) {
  return useQuery({
    queryKey: ['leaderboard', limit],
    queryFn: () => scoresService.getLeaderboard(limit),
  })
}

/**
 * Hook para adicionar pontos
 */
export function useAddPoints() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, points }) => scoresService.addPoints(userId, points),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scores'] })
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
    },
  })
}
