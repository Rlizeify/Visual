// Auth, role and feature gating, driven by the route registry.
// UI only — the API (requireAdmin) and RLS (has_feature) enforce.

import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useProfile } from '../../context/ProfileContext'
import { lacksFeature, type RouteEntry } from '../routes'
import LoadingScreen from '../../components/LoadingScreen'

export default function Gate({ route, children }: { route: RouteEntry; children: ReactNode }) {
  const { user, loading } = useAuth()
  const { profile, features } = useProfile()
  const location = useLocation()

  if (!route.requiresAuth && !route.requiresRole && !route.feature) return <>{children}</>
  if (loading) return <LoadingScreen />
  // Guests on a public page that is feature-gated for accounts.
  if (!user && !route.requiresAuth) return <>{children}</>
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  if (route.requiresRole || route.feature) {
    if (!profile || profile.id !== user.id) return <LoadingScreen label="Checking access" />
    if (route.requiresRole === 'admin' && !profile.is_admin) return <Denied title="Admins only" />
    if (lacksFeature(route, { signedIn: true, isAdmin: !!profile.is_admin, features })) {
      // Hidden pages stay hidden: no "no access" screen that confirms they exist.
      if (route.hidden) return <Navigate to="/" replace />
      return <Denied title="No access" />
    }
  }
  return <>{children}</>
}

function Denied({ title }: { title: string }) {
  return (
    <main className="page">
      <div className="container container--narrow stack gate-denied">
        <p className="eyebrow">Restricted</p>
        <h1>{title}</h1>
        <p className="muted">This account doesn&apos;t have access to this page. Ask an admin to grant it.</p>
      </div>
    </main>
  )
}
