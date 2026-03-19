import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { paymentsService } from '@/services/payments.service'

export function usePaymentInfo(userId) {
  return useQuery({
    queryKey: ['payment-info', userId],
    queryFn: () => paymentsService.getPaymentInfo(userId),
    enabled: !!userId,
  })
}

export function useMyPayments(userId) {
  return useQuery({
    queryKey: ['payments', userId],
    queryFn: () => paymentsService.getMyPayments(userId),
    enabled: !!userId,
  })
}

export function useUpsertPaymentInfo(userId) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload) => paymentsService.upsertPaymentInfo(userId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-info', userId] })
      queryClient.invalidateQueries({ queryKey: ['payments', userId] })
    },
  })
}
