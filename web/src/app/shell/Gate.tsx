// Auth, role and feature gating, driven by the route registry.
// UI only — the API (requireAdmin) and RLS (has_feature) enforce.

import { useRef, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useProfile } from '../../context/ProfileContext'
import { lacksFeature, type RouteEntry } from '../routes'
import { useSongUnlockFor } from '../songUnlock'
import LoadingScreen from '../../components/LoadingScreen'

export default function Gate({ route, children }: { route: RouteEntry; children: ReactNode }) {
  const { user, loading } = useAuth()
  const { profile, features } = useProfile()
  const songUnlock = useSongUnlockFor(user?.id)
  // Song-unlocked pages stay open after the song ends.
  const opened = useRef(false)
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
      if (route.hidden || route.songUnlock) return <Navigate to="/" replace />
      return <Denied title="No access" />
    }
  }
  if (route.songUnlock && !opened.current) {
    if (songUnlock === 'checking') return <LoadingScreen label="Checking access" />
    if (songUnlock !== 'on') return <Navigate to="/" replace />
    opened.current = true
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
