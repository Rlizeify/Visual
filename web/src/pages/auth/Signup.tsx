import { useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { safeNext } from '../../app/routes'
import { PASSWORD_MAX, isBreachedPassword, passwordProblems } from '../../lib/password'
import './auth.css'

// 3–20 chars, lowercase letters/numbers/underscores.
function validateUsername(u: string): string | null {
  if (u.length < 3) return 'Username must be at least 3 characters.'
  if (u.length > 20) return 'Username must be at most 20 characters.'
  if (!/^[a-z0-9_]+$/.test(u)) return 'Username can only contain lowercase letters, numbers and underscores.'
  return null
}

export default function Signup() {
  const { user, signUp, signInWithSpotify } = useAuth()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const problems = passwordProblems(password, [email, username])

  if (user && !success) return <Navigate to={next} replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const usernameError = validateUsername(username)
    if (usernameError) { setError(usernameError); return }
    if (problems.length) { setError('Password needs: ' + problems.join(', ').toLowerCase() + '.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    if (await isBreachedPassword(password)) {
      setError('That password has shown up in a data breach. Pick a different one.')
      setLoading(false)
      return
    }
    const { error } = await signUp(email, password, username)
    if (error) setError(error.message)
    else setSuccess(true)
    setLoading(false)
  }

  const handleSpotify = async () => {
    setError(null)
    const { error } = await signInWithSpotify()
    if (error) setError(error.message)
  }

  return (
    <main className="page auth">
      <div className="container container--narrow">
        <section className="card auth__card">
          {success ? (
            <>
              <p className="eyebrow">Almost there</p>
              <h1 className="auth__title">Check your email</h1>
              <p className="muted">Click the link we sent to activate your account.</p>
              <Link to="/login" className="btn btn--primary btn--block">Back to sign in</Link>
            </>
          ) : (
            <>
              <p className="eyebrow">MHEU</p>
              <h1 className="auth__title">Create account</h1>
              <form className="stack" onSubmit={handleSubmit}>
                <label className="field">
                  <span>Email</span>
                  <input className="input" type="email" autoComplete="email" value={email}
                    onChange={e => setEmail(e.target.value)} required />
                </label>
                <label className="field">
                  <span>Username</span>
                  <input className="input" type="text" autoComplete="username" value={username}
                    placeholder="3–20 chars: a–z, 0–9, _"
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} required />
                </label>
                <label className="field">
                  <span>Password</span>
                  <input className="input" type="password" autoComplete="new-password" value={password}
                    maxLength={PASSWORD_MAX} aria-describedby="pw-rules"
                    onChange={e => setPassword(e.target.value)} required />
                </label>
                <ul id="pw-rules" className="auth__rules">
                  {passwordProblems('', []).map(rule => {
                    const ok = password.length > 0 && !problems.includes(rule)
                    return <li key={rule} className={ok ? 'is-ok' : undefined}>{rule}</li>
                  })}
                  {password.length > 0 && problems
                    .filter(p => !passwordProblems('', []).includes(p))
                    .map(p => <li key={p} className="is-bad">{p}</li>)}
                </ul>
                <label className="field">
                  <span>Confirm password</span>
                  <input className="input" type="password" autoComplete="new-password" value={confirm}
                    onChange={e => setConfirm(e.target.value)} required />
                </label>
                {error && <p className="alert" role="alert">{error}</p>}
                <button type="submit" className="btn btn--primary btn--block" disabled={loading}>
                  {loading ? 'Creating account…' : 'Create account'}
                </button>
              </form>
              <div className="divider-or">OR</div>
              <button type="button" className="btn btn--spotify btn--block" onClick={handleSpotify}>
                Continue with Spotify
              </button>
              <p className="auth__alt muted">
                Have an account? <Link to={`/login${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`}>Sign in</Link>
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
