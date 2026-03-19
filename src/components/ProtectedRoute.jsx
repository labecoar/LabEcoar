import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function ProtectedRoute({ children, requireAdmin = false, requireCompleteProfile = true, redirectTo = '/' }) {
  const { isAuthenticated, isAdmin, isProfileComplete, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-200 border-t-emerald-600"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/Login" replace />
  }

  if (!isAdmin && requireCompleteProfile && !isProfileComplete) {
    return <Navigate to="/CompleteProfile" replace />
  }

  if (!isAdmin && location.pathname === '/CompleteProfile' && isProfileComplete) {
    return <Navigate to="/" replace />
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to={redirectTo} replace />
  }

  return children
}
