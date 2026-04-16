import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { submissionsService } from '@/services/submissions.service'

/**
 * Hook para buscar submissões do usuário
 */
export function useMySubmissions(userId) {
  return useQuery({
    queryKey: ['submissions', 'user', userId],
    queryFn: () => submissionsService.getUserSubmissions(userId),
    enabled: !!userId,
  })
}

/**
 * Hook para buscar submissões pendentes (Admin)
 */
export function usePendingSubmissions() {
  return useQuery({
    queryKey: ['submissions', 'pending'],
    queryFn: () => submissionsService.getPendingSubmissions(),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  })
}

/**
 * Hook para criar submissão
 */
export function useCreateSubmission() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (submissionData) => submissionsService.createSubmission(submissionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions'] })
      queryClient.invalidateQueries({ queryKey: ['scores'] })
    },
  })
}

/**
 * Hook para envio de prova após aprovação da inscrição
 */
export function useSubmitProof() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ submissionId, proofData }) => submissionsService.submitProof(submissionId, proofData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions'] })
    },
  })
}

/**
 * Hook para aprovar submissão
 */
export function useApproveSubmission() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ submissionId, pointsAwarded }) => 
      submissionsService.approveSubmission(submissionId, pointsAwarded),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions'] })
      queryClient.invalidateQueries({ queryKey: ['scores'] })
    },
  })
}

/**
 * Hook para rejeitar submissão
 */
export function useRejectSubmission() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ submissionId, rejectionReason }) => 
      submissionsService.rejectSubmission(submissionId, rejectionReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions'] })
    },
  })
}

export function useResetSubmissionReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ submissionId }) => submissionsService.resetSubmissionReview(submissionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions'] })
      queryClient.invalidateQueries({ queryKey: ['scores'] })
    },
  })
}
