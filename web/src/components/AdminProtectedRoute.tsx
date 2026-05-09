import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

interface AdminProtectedRouteProps {
  children: ReactNode
}

export default function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const navigate = useNavigate()
  const { session, loading: authLoading } = useAuth()
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (authLoading) return

    const checkAdmin = async () => {
      if (!session) {
        navigate('/admin/login', { replace: true })
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single()

      if (error || !data?.is_admin) {
        // Sign out and redirect with error
        await supabase.auth.signOut()
        navigate('/admin/login?error=ACCESS%20DENIED', { replace: true })
        return
      }

      setIsAdmin(true)
      setChecking(false)
    }

    checkAdmin()
  }, [session, authLoading, navigate])

  if (authLoading || checking) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Courier New', Courier, monospace",
        color: '#333',
        fontSize: '12px',
        letterSpacing: '0.15em',
      }}>
        VERIFYING ACCESS...
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return <>{children}</>
}
