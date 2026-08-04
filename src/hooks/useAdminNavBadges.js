import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { usePendingSubmissions } from '@/hooks/useSubmissions'
import { metricsService } from '@/services/metrics.service'

const normalizeSubmissionStatus = (status) => {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'pendente') return 'application_pending'
  if (normalized === 'aprovada' || normalized === 'aprovado') return 'approved'
  if (normalized === 'rejeitada' || normalized === 'rejeitado') return 'rejected'
  return normalized
}

const isSidequestSubmission = (submission) =>
  String(submission?.task?.category || '') === 'sidequest_teste'

/**
 * Indicadores de novidade no menu admin (ponto vermelho no ícone).
 * Reutiliza as mesmas queries das telas de aprovação.
 */
export function useAdminNavBadges() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const { data: pendingSubmissions = [] } = usePendingSubmissions()

  const { data: pendingMetricsSubmissions = [] } = useQuery({
    queryKey: ['metrics-submissions', 'admin', 'pending'],
    queryFn: () => metricsService.getAdminMetricsByStatus('pending'),
    enabled: isAdmin,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  })

  return useMemo(() => {
    if (!isAdmin) {
      return {
        selection: false,
        scripts: false,
        proofs: false,
        metrics: false,
      }
    }

    const hasPendingSelection = pendingSubmissions.some((submission) => {
      if (isSidequestSubmission(submission)) return false
      return ['application_pending', 'pending'].includes(normalizeSubmissionStatus(submission.status))
    })

    const hasPendingScripts = pendingSubmissions.some((submission) =>
      String(submission?.task?.category || '') === 'campanha'
      && normalizeSubmissionStatus(submission.status) === 'script_pending'
    )

    const hasPendingProofs = pendingSubmissions.some((submission) =>
      normalizeSubmissionStatus(submission.status) === 'proof_pending'
    )

    const hasPendingMetrics = pendingMetricsSubmissions.length > 0

    return {
      selection: hasPendingSelection,
      scripts: hasPendingScripts,
      proofs: hasPendingProofs,
      metrics: hasPendingMetrics,
    }
  }, [isAdmin, pendingMetricsSubmissions, pendingSubmissions])
}
