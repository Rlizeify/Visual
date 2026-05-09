import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { colors, panel } from '../styles/tokens'

interface LoginProps {
  onSwitchToSignup: () => void
}

export default function Login({ onSwitchToSignup }: LoginProps) {
  const { signIn, signInWithSpotify } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await signIn(email, password)
    if (error) {
      setError(error.message)
    }
    setLoading(false)
  }

  const handleSpotifyLogin = async () => {
    setError(null)
    const { error } = await signInWithSpotify()
    if (error) {
      setError(error.message)
    }
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: panel.background,
        backdropFilter: panel.backdropFilter,
        WebkitBackdropFilter: panel.backdropFilter,
        border: panel.border,
        borderRadius: panel.borderRadius,
        padding: '40px',
        width: '100%',
        maxWidth: '400px',
      }}>
        <h1 style={{
          color: colors.tealPrimary,
          fontSize: '24px',
          fontWeight: 'normal',
          textAlign: 'center',
          marginBottom: '32px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          Sign In
        </h1>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{
              display: 'block',
              color: colors.secondary,
              fontSize: '12px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'rgba(0, 20, 30, 0.8)',
                border: `1px solid ${colors.panelBorder}`,
                color: colors.tealPrimary,
                fontSize: '14px',
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              color: colors.secondary,
              fontSize: '12px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'rgba(0, 20, 30, 0.8)',
                border: `1px solid ${colors.panelBorder}`,
                color: colors.tealPrimary,
                fontSize: '14px',
              }}
            />
          </div>

          {error && (
            <p style={{
              color: colors.error,
              fontSize: '12px',
              textAlign: 'center',
            }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: colors.tealPrimary,
              color: colors.bg,
              border: 'none',
              fontSize: '14px',
              fontWeight: 'bold',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.6 : 1,
              marginTop: '8px',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          margin: '24px 0',
          gap: '16px',
        }}>
          <div style={{ flex: 1, height: '1px', background: colors.panelBorder }} />
          <span style={{ color: colors.secondary, fontSize: '12px', letterSpacing: '0.08em' }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: colors.panelBorder }} />
        </div>

        <button
          onClick={handleSpotifyLogin}
          style={{
            width: '100%',
            padding: '14px',
            background: '#1DB954',
            color: '#fff',
            border: 'none',
            fontSize: '14px',
            fontWeight: 'bold',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            borderRadius: '500px',
          }}
        >
          Continue with Spotify
        </button>

        <p style={{
          textAlign: 'center',
          marginTop: '24px',
          color: colors.secondary,
          fontSize: '13px',
        }}>
          Don't have an account?{' '}
          <button
            onClick={onSwitchToSignup}
            style={{
              background: 'none',
              border: 'none',
              color: colors.tealPrimary,
              cursor: 'pointer',
              textDecoration: 'underline',
              fontSize: '13px',
            }}
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  )
}
