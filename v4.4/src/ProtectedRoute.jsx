import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Spinner from './components/ui/Spinner'

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { session, profile, loading, isAdmin } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner full label="Authenticating…" />

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
        <div className="w-14 h-14 rounded-full bg-red-900/40 border border-red-800 flex items-center justify-center">
          <span className="text-2xl">🔒</span>
        </div>
        <h1 className="text-xl font-semibold text-white">Admin access required</h1>
        <p className="text-gray-400 max-w-sm">
          This page is restricted to administrators. You're signed in as a technician.
        </p>
        <a href="/dashboard" className="btn-secondary">Back to dashboard</a>
      </div>
    )
  }

  // Profile still loading after session established
  if (!profile) return <Spinner full label="Loading profile…" />

  return children
}
