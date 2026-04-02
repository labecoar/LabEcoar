import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { scoresService } from '@/services/scores.service'

/**
 * Hook para buscar pontuação do usuário
 */
export function useUserScore(userId, quarterKey) {
  return useQuery({
    queryKey: ['scores', userId, quarterKey],
    queryFn: () => scoresService.getUserScore(userId, quarterKey),
    enabled: !!userId,
  })
}

/**
 * Hook para histórico de pontuação por trimestre
 */
export function useUserScoreHistory(userId, limit = 8) {
  return useQuery({
    queryKey: ['scores-history', userId, limit],
    queryFn: () => scoresService.getUserScoreHistory(userId, limit),
    enabled: !!userId,
  })
}

/**
 * Hook para buscar ranking
 */
export function useLeaderboard(limit = 100, quarterKey) {
  return useQuery({
    queryKey: ['leaderboard', limit, quarterKey],
    queryFn: () => scoresService.getLeaderboard(limit, quarterKey),
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
