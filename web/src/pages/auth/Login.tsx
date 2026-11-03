import { useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { safeNext } from '../../app/routes'
import './auth.css'

export default function Login() {
  const { user, signIn, signInWithSpotify } = useAuth()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [identifier, setIdentifier] = useState('') // email or username
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to={next} replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(identifier, password, !identifier.includes('@'))
    if (error) setError(error.message)
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
          <p className="eyebrow">MHEU</p>
          <h1 className="auth__title">Sign in</h1>

          <form className="stack" onSubmit={handleSubmit} noValidate={false}>
            <label className="field">
              <span>Email or username</span>
              <input className="input" type="text" autoComplete="username" value={identifier}
                onChange={e => setIdentifier(e.target.value)} required />
            </label>
            <label className="field">
              <span>Password</span>
              <input className="input" type="password" autoComplete="current-password" value={password}
                onChange={e => setPassword(e.target.value)} required />
            </label>
            {error && <p className="alert" role="alert">{error}</p>}
            <button type="submit" className="btn btn--primary btn--block" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="divider-or">OR</div>
          <button type="button" className="btn btn--spotify btn--block" onClick={handleSpotify}>
            Continue with Spotify
          </button>

          <p className="auth__alt muted">
            No account? <Link to={`/signup${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`}>Create one</Link>
          </p>
        </section>
      </div>
    </main>
  )
}
