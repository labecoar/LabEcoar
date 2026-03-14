import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { metricsService } from '@/services/metrics.service'

export function useAdminMetricsByStatus(status) {
  return useQuery({
    queryKey: ['metrics-submissions', 'admin', status],
    queryFn: () => metricsService.getAdminMetricsByStatus(status),
    enabled: !!status,
  })
}

export function useMyMetricsSubmissions(userId) {
  return useQuery({
    queryKey: ['metrics-submissions', 'user', userId],
    queryFn: () => metricsService.getUserMetricsSubmissions(userId),
    enabled: !!userId,
  })
}

export function useApproveMetricsSubmission() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (metricsSubmissionId) => metricsService.approveMetricsSubmission(metricsSubmissionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metrics-submissions', 'admin', 'pending'] })
      queryClient.invalidateQueries({ queryKey: ['metrics-submissions', 'admin', 'approved'] })
    },
  })
}

export function useRejectMetricsSubmission() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ metricsSubmissionId, rejectionReason }) =>
      metricsService.rejectMetricsSubmission(metricsSubmissionId, rejectionReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metrics-submissions', 'admin', 'pending'] })
      queryClient.invalidateQueries({ queryKey: ['metrics-submissions', 'admin', 'rejected'] })
    },
  })
}

export function useSubmitMetricsSubmission() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload) => metricsService.submitMetricsSubmission(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metrics-submissions'] })
    },
  })
}
