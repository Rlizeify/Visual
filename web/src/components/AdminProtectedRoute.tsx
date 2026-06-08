import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

type GateState =
  | { status: 'checking' }
  | { status: 'admin' }
  | { status: 'denied' }
  | { status: 'unauthed' }

interface Props {
  children: ReactNode
}

export default function AdminProtectedRoute({ children }: Props) {
  // [theme-diag] INV2 S6 — temporary; removed after diagnosis.
  console.log('[theme-diag] AdminProtectedRoute MOUNT', { at: new Date().toISOString() })
  const { session, loading: authLoading } = useAuth()
  const [gate, setGate] = useState<GateState>({ status: 'checking' })

  useEffect(() => {
    let cancelled = false

    async function check() {
      if (authLoading) return
      if (!session?.user) {
        if (!cancelled) setGate({ status: 'unauthed' })
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .maybeSingle()

      if (cancelled) return

      if (error || !data?.is_admin) {
        // Sign the session out so the rejected user isn't left half-authed.
        // The redirect below sends them to /admin/login with an explicit error
        // banner so it's clear what happened.
        await supabase.auth.signOut()
        if (!cancelled) setGate({ status: 'denied' })
        return
      }

      setGate({ status: 'admin' })
    }

    check()
    return () => {
      cancelled = true
    }
  }, [authLoading, session])

  if (authLoading || gate.status === 'checking') {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          background: '#000',
          color: '#7a7a7a',
          fontFamily: "'Courier New', Consolas, ui-monospace, monospace",
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          letterSpacing: '0.18em',
          fontSize: 12,
        }}
      >
        VERIFYING CLEARANCE…
      </div>
    )
  }

  if (gate.status === 'unauthed') {
    return <Navigate to="/admin/login" replace />
  }

  if (gate.status === 'denied') {
    return <Navigate to="/admin/login?error=access_denied" replace />
  }

  return <>{children}</>
}
