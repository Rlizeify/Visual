import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Brute-force stopgap. NOT a real defense — see admin-bootstrap.md.
// localStorage key holds { attempts, lockedUntil } so refresh / new tab
// in the same browser still respects the lock.
const LOCKOUT_KEY = 'admin_login_lockout'
const MAX_ATTEMPTS = 5
const LOCK_MS = 15 * 60 * 1000

interface Lockout {
  attempts: number
  lockedUntil: number | null
}

function readLockout(): Lockout {
  try {
    const raw = localStorage.getItem(LOCKOUT_KEY)
    if (!raw) return { attempts: 0, lockedUntil: null }
    const parsed = JSON.parse(raw) as Lockout
    return {
      attempts: typeof parsed.attempts === 'number' ? parsed.attempts : 0,
      lockedUntil: typeof parsed.lockedUntil === 'number' ? parsed.lockedUntil : null,
    }
  } catch {
    return { attempts: 0, lockedUntil: null }
  }
}

function writeLockout(l: Lockout) {
  localStorage.setItem(LOCKOUT_KEY, JSON.stringify(l))
}

function clearLockout() {
  localStorage.removeItem(LOCKOUT_KEY)
}

const palette = {
  bg: '#000000',
  fg: '#d8d8d8',
  fgDim: '#7a7a7a',
  accent: '#ff2d2d',
  accentDim: 'rgba(255, 45, 45, 0.5)',
  border: 'rgba(255, 45, 45, 0.6)',
}

const mono = "'Courier New', Consolas, ui-monospace, monospace"

export default function AdminLogin() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { session, loading: authLoading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lockout, setLockout] = useState<Lockout>(() => readLockout())
  const [now, setNow] = useState(Date.now())

  const initialAccessDenied = searchParams.get('error') === 'access_denied'
  const [accessDenied, setAccessDenied] = useState(initialAccessDenied)

  // If a session already exists when we land here, jump straight to /admin —
  // AdminProtectedRoute makes the final is_admin decision.
  useEffect(() => {
    if (!authLoading && session && !accessDenied) {
      navigate('/admin', { replace: true })
    }
  }, [authLoading, session, accessDenied, navigate])

  // Keep the countdown timer ticking while locked.
  useEffect(() => {
    if (!lockout.lockedUntil) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [lockout.lockedUntil])

  const isLocked = lockout.lockedUntil !== null && now < lockout.lockedUntil
  const lockSecondsRemaining = isLocked
    ? Math.ceil(((lockout.lockedUntil ?? 0) - now) / 1000)
    : 0

  // Auto-clear lock on expiry so subsequent submits don't read stale state.
  useEffect(() => {
    if (lockout.lockedUntil && now >= lockout.lockedUntil) {
      clearLockout()
      setLockout({ attempts: 0, lockedUntil: null })
    }
  }, [now, lockout.lockedUntil])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (isLocked || submitting) return
    setSubmitting(true)
    setError(null)
    setAccessDenied(false)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      const next: Lockout = {
        attempts: lockout.attempts + 1,
        lockedUntil: lockout.attempts + 1 >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : null,
      }
      writeLockout(next)
      setLockout(next)
      setError(signInError.message)
      setSubmitting(false)
      return
    }

    // Success — clear the counter and let the redirect effect carry us to /admin.
    clearLockout()
    setLockout({ attempts: 0, lockedUntil: null })
    setSubmitting(false)
  }

  return (
    <div style={styles.root}>
      <div style={styles.frame}>
        <div style={styles.headerRow}>
          <span style={styles.bracket}>[</span>
          <span style={styles.title}>ADMIN // RESTRICTED</span>
          <span style={styles.bracket}>]</span>
        </div>

        <div style={styles.subtitle}>authorized personnel only</div>

        {accessDenied && (
          <div style={styles.banner}>
            ACCESS DENIED — your account is not authorized for this console. Sign in with an admin account.
          </div>
        )}

        {isLocked && (
          <div style={styles.banner}>
            LOCKED — too many failed attempts. Try again in {formatLockTime(lockSecondsRemaining)}.
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            <span style={styles.labelText}>&gt; user@email</span>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="username"
              required
              disabled={isLocked || submitting}
              style={styles.input}
            />
          </label>

          <label style={styles.label}>
            <span style={styles.labelText}>&gt; password</span>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={isLocked || submitting}
              style={styles.input}
            />
          </label>

          {error && !isLocked && (
            <div style={styles.errorLine}>
              ERR: {error} ({MAX_ATTEMPTS - lockout.attempts} attempt{MAX_ATTEMPTS - lockout.attempts === 1 ? '' : 's'} remaining)
            </div>
          )}

          <button
            type="submit"
            disabled={isLocked || submitting}
            style={{
              ...styles.submit,
              opacity: isLocked || submitting ? 0.4 : 1,
              cursor: isLocked || submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'AUTHENTICATING…' : '> AUTHENTICATE'}
          </button>
        </form>

        <div style={styles.footnote}>
          all access is logged. failed attempts are throttled. this is not the consumer login.
        </div>
      </div>
    </div>
  )
}

function formatLockTime(secs: number) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    width: '100vw',
    height: '100vh',
    background: palette.bg,
    color: palette.fg,
    fontFamily: mono,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  frame: {
    width: '100%',
    maxWidth: 460,
    border: `1px solid ${palette.border}`,
    borderRadius: 0,
    padding: '28px 32px 24px',
    background: '#050505',
    boxShadow: 'none',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 4,
    color: palette.accent,
    fontSize: 14,
    letterSpacing: '0.18em',
  },
  bracket: {
    color: palette.accentDim,
  },
  title: {
    fontWeight: 700,
  },
  subtitle: {
    color: palette.fgDim,
    fontSize: 11,
    letterSpacing: '0.24em',
    textTransform: 'uppercase',
    marginBottom: 24,
  },
  banner: {
    border: `1px solid ${palette.accent}`,
    color: palette.accent,
    padding: '8px 10px',
    fontSize: 11,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: 18,
    whiteSpace: 'pre-wrap' as const,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  labelText: {
    color: palette.fgDim,
    fontSize: 11,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  input: {
    background: '#0a0a0a',
    color: palette.fg,
    border: `1px solid ${palette.accentDim}`,
    borderRadius: 0,
    padding: '8px 10px',
    fontFamily: mono,
    fontSize: 13,
    outline: 'none',
  },
  errorLine: {
    color: palette.accent,
    fontSize: 11,
    letterSpacing: '0.05em',
  },
  submit: {
    marginTop: 6,
    background: 'transparent',
    color: palette.accent,
    border: `1px solid ${palette.accent}`,
    borderRadius: 0,
    padding: '10px 14px',
    fontFamily: mono,
    fontSize: 12,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
  },
  footnote: {
    marginTop: 22,
    color: palette.fgDim,
    fontSize: 10,
    letterSpacing: '0.06em',
  },
}
