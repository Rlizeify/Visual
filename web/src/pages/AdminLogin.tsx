import { useState, useEffect, type FormEvent, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const LOCKOUT_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

interface LockoutState {
  attempts: number
  lockedUntil: number | null
}

function getLockoutState(): LockoutState {
  const stored = localStorage.getItem('admin_lockout')
  if (!stored) return { attempts: 0, lockedUntil: null }
  try {
    return JSON.parse(stored)
  } catch {
    return { attempts: 0, lockedUntil: null }
  }
}

function setLockoutState(state: LockoutState) {
  localStorage.setItem('admin_lockout', JSON.stringify(state))
}

export default function AdminLogin() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signIn, session } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(searchParams.get('error'))
  const [loading, setLoading] = useState(false)
  const [lockout, setLockout] = useState<LockoutState>(getLockoutState)
  const [timeRemaining, setTimeRemaining] = useState(0)

  // Check if already authed and is admin
  useEffect(() => {
    if (!session) return

    const checkAdmin = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single()

      if (!error && data?.is_admin) {
        navigate('/admin', { replace: true })
      }
    }
    checkAdmin()
  }, [session, navigate])

  // Lockout timer
  useEffect(() => {
    if (!lockout.lockedUntil) return

    const remaining = lockout.lockedUntil - Date.now()
    if (remaining <= 0) {
      const newState = { attempts: 0, lockedUntil: null }
      setLockout(newState)
      setLockoutState(newState)
      return
    }

    setTimeRemaining(Math.ceil(remaining / 1000))
    const interval = setInterval(() => {
      const r = lockout.lockedUntil! - Date.now()
      if (r <= 0) {
        const newState = { attempts: 0, lockedUntil: null }
        setLockout(newState)
        setLockoutState(newState)
        clearInterval(interval)
      } else {
        setTimeRemaining(Math.ceil(r / 1000))
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [lockout.lockedUntil])

  const isLockedOut = lockout.lockedUntil && lockout.lockedUntil > Date.now()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (isLockedOut) return

    setError(null)
    setLoading(true)

    const { error: authError } = await signIn(email, password)

    if (authError) {
      const newAttempts = lockout.attempts + 1
      const newState: LockoutState = {
        attempts: newAttempts,
        lockedUntil: newAttempts >= LOCKOUT_ATTEMPTS
          ? Date.now() + LOCKOUT_DURATION_MS
          : null,
      }
      setLockout(newState)
      setLockoutState(newState)

      if (newAttempts >= LOCKOUT_ATTEMPTS) {
        setError(`Too many failed attempts. Locked for 15 minutes.`)
      } else {
        setError(`Invalid credentials. ${LOCKOUT_ATTEMPTS - newAttempts} attempts remaining.`)
      }
      setLoading(false)
      return
    }

    // Auth succeeded - check if admin
    const { data: { session: newSession } } = await supabase.auth.getSession()
    if (!newSession) {
      setError('Authentication failed')
      setLoading(false)
      return
    }

    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', newSession.user.id)
      .single()

    if (profileError || !data?.is_admin) {
      await supabase.auth.signOut()
      setError('ACCESS DENIED')
      setLoading(false)
      return
    }

    // Reset lockout on successful admin login
    const resetState = { attempts: 0, lockedUntil: null }
    setLockout(resetState)
    setLockoutState(resetState)

    navigate('/admin', { replace: true })
  }

  const containerStyle: CSSProperties = {
    width: '100vw',
    height: '100vh',
    background: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Courier New', Courier, monospace",
  }

  const boxStyle: CSSProperties = {
    background: '#0a0a0a',
    border: '1px solid #333',
    padding: '40px',
    width: '100%',
    maxWidth: '400px',
  }

  const titleStyle: CSSProperties = {
    color: '#ff3333',
    fontSize: '14px',
    fontWeight: 'normal',
    textAlign: 'center',
    marginBottom: '32px',
    letterSpacing: '0.3em',
    textTransform: 'uppercase',
  }

  const labelStyle: CSSProperties = {
    display: 'block',
    color: '#666',
    fontSize: '11px',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    marginBottom: '6px',
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    background: '#111',
    border: '1px solid #333',
    color: '#ccc',
    fontSize: '14px',
    fontFamily: "'Courier New', Courier, monospace",
    outline: 'none',
  }

  const buttonStyle: CSSProperties = {
    width: '100%',
    padding: '12px',
    background: isLockedOut ? '#1a0000' : '#330000',
    color: isLockedOut ? '#4a2020' : '#ff3333',
    border: `1px solid ${isLockedOut ? '#2a1010' : '#550000'}`,
    fontSize: '12px',
    fontWeight: 'bold',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    cursor: isLockedOut || loading ? 'not-allowed' : 'pointer',
    fontFamily: "'Courier New', Courier, monospace",
    marginTop: '16px',
  }

  const errorStyle: CSSProperties = {
    color: '#ff3333',
    fontSize: '11px',
    textAlign: 'center',
    padding: '12px',
    background: 'rgba(255, 51, 51, 0.1)',
    border: '1px solid rgba(255, 51, 51, 0.3)',
    marginBottom: '16px',
    letterSpacing: '0.1em',
  }

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div style={containerStyle}>
      <div style={boxStyle}>
        <h1 style={titleStyle}>// ADMIN ACCESS</h1>

        {error && <div style={errorStyle}>{error}</div>}

        {isLockedOut && (
          <div style={{
            ...errorStyle,
            background: 'rgba(255, 51, 51, 0.15)',
          }}>
            LOCKED: {formatTime(timeRemaining)} remaining
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={!!isLockedOut}
              style={{
                ...inputStyle,
                opacity: isLockedOut ? 0.5 : 1,
              }}
              autoComplete="email"
            />
          </div>

          <div>
            <label style={labelStyle}>PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={!!isLockedOut}
              style={{
                ...inputStyle,
                opacity: isLockedOut ? 0.5 : 1,
              }}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !!isLockedOut}
            style={buttonStyle}
          >
            {loading ? 'AUTHENTICATING...' : isLockedOut ? 'LOCKED' : 'AUTHENTICATE'}
          </button>
        </form>

        <div style={{
          marginTop: '32px',
          textAlign: 'center',
          color: '#333',
          fontSize: '10px',
          letterSpacing: '0.1em',
        }}>
          AUTHORIZED PERSONNEL ONLY
        </div>
      </div>
    </div>
  )
}
