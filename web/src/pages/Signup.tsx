import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { colors, panel } from '../styles/tokens'

interface SignupProps {
  onSwitchToLogin: () => void
}

export default function Signup({ onSwitchToLogin }: SignupProps) {
  const { signUp, signInWithSpotify } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    const { error } = await signUp(email, password)
    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
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

  if (success) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: colors.bg,
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
          textAlign: 'center',
        }}>
          <h2 style={{
            color: colors.tealPrimary,
            fontSize: '20px',
            fontWeight: 'normal',
            marginBottom: '16px',
          }}>
            Check your email
          </h2>
          <p style={{ color: colors.secondary, fontSize: '14px', lineHeight: 1.5 }}>
            We sent a confirmation link to <strong style={{ color: colors.tealPrimary }}>{email}</strong>.
            Click the link to activate your account.
          </p>
          <button
            onClick={onSwitchToLogin}
            style={{
              marginTop: '24px',
              background: 'none',
              border: `1px solid ${colors.panelBorder}`,
              color: colors.tealPrimary,
              padding: '12px 24px',
              fontSize: '13px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Back to Sign In
          </button>
        </div>
      </div>
    )
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
          Create Account
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

          <div>
            <label style={{
              display: 'block',
              color: colors.secondary,
              fontSize: '12px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}>
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            {loading ? 'Creating account...' : 'Create Account'}
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
          Already have an account?{' '}
          <button
            onClick={onSwitchToLogin}
            style={{
              background: 'none',
              border: 'none',
              color: colors.tealPrimary,
              cursor: 'pointer',
              textDecoration: 'underline',
              fontSize: '13px',
            }}
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  )
}
