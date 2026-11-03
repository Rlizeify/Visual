// Auth + role gating, driven by the route registry.

import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useProfile } from '../../context/ProfileContext'
import type { RouteEntry } from '../routes'
import LoadingScreen from '../../components/LoadingScreen'

export default function Gate({ route, children }: { route: RouteEntry; children: ReactNode }) {
  const { user, loading } = useAuth()
  const { profile } = useProfile()
  const location = useLocation()

  if (!route.requiresAuth && !route.requiresRole) return <>{children}</>
  if (loading) return <LoadingScreen />
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  if (route.requiresRole === 'admin') {
    if (!profile || profile.id !== user.id) return <LoadingScreen label="Checking access" />
    if (!profile.is_admin) {
      return (
        <main className="page">
          <div className="container container--narrow stack gate-denied">
            <p className="eyebrow">Restricted</p>
            <h1>Admins only</h1>
            <p className="muted">This account doesn&apos;t have access to this page.</p>
          </div>
        </main>
      )
    }
  }
  return <>{children}</>
}
