import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-500">Loading…</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!user.is_approved) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="card max-w-md w-full mx-4 p-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Awaiting Approval</h2>
          <p className="text-sm text-slate-500 mb-6">
            Your account has been created and is waiting for an administrator to approve it.
            You'll be able to log in once your account has been approved.
          </p>
          <button
            onClick={() => { localStorage.removeItem('token'); window.location.href = '/login' }}
            className="btn-secondary w-full"
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
