import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { buildAuthUrl, type CallbackErrorReason } from '../../services/spotify/auth'

const ERROR_COPY: Record<CallbackErrorReason, string> = {
  access_denied:         'You declined the Spotify permission prompt. Try again to continue.',
  state_mismatch:        "Something interfered with the sign-in (CSRF check failed). Try again from this device.",
  missing_code:          'Sign-in state was lost between Spotify and this page. Try again.',
  token_exchange_failed: "Spotify couldn't complete the sign-in. Try again — if it keeps failing, the app may need to be reconnected.",
  network:               "Couldn't reach Spotify. Check your connection and try again.",
}

function isErrorReason(s: string | null): s is CallbackErrorReason {
  return s !== null && Object.prototype.hasOwnProperty.call(ERROR_COPY, s)
}

export default function LoginPage() {
  const [authUrl, setAuthUrl] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  const rawError = searchParams.get('error')
  const errorReason = isErrorReason(rawError) ? rawError : null

  useEffect(() => {
    buildAuthUrl().then(setAuthUrl)
  }, [])

  const handleLogin = () => {
    if (authUrl) window.location.href = authUrl
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#010103',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {errorReason && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: 480,
            padding: '12px 16px',
            background: 'rgba(135, 21, 10, 0.92)',
            color: '#fff',
            fontFamily: "'HitmarkerText', monospace",
            fontSize: '13px',
            letterSpacing: '0.03em',
            borderRadius: 4,
            boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
            zIndex: 10,
          }}
        >
          {ERROR_COPY[errorReason]}
        </div>
      )}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '48px',
      }}>
        {/* Sign in button panel */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}>
          <p style={{
            color: 'var(--color-secondary)',
            fontSize: '14px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '8px',
          }}>
            Sign in here
          </p>
          <button
            onClick={handleLogin}
            disabled={!authUrl}
            style={{
              background: '#1DB954',
              color: '#fff',
              border: 'none',
              padding: '16px 48px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: authUrl ? 'pointer' : 'default',
              fontFamily: 'inherit',
              borderRadius: '500px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              opacity: authUrl ? 1 : 0.5,
              transition: 'opacity 0.2s',
            }}
          >
            Login with Spotify
          </button>
        </div>

        {/* Divider */}
        <div style={{
          width: '1px',
          height: '120px',
          background: 'var(--color-panel-border)',
        }} className="qr-divider" />

        {/* QR code panel */}
        <div
          className="qr-panel"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            background: 'var(--color-panel-bg)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid var(--color-panel-border)',
            borderRadius: '4px',
            padding: '24px',
          }}
        >
          <div style={{
            background: '#fff',
            padding: '8px',
            lineHeight: 0,
          }}>
            {authUrl ? (
              <QRCodeSVG
                value={authUrl}
                size={200}
                bgColor="#ffffff"
                fgColor="#010103"
                level="M"
              />
            ) : (
              <div style={{
                width: 200,
                height: 200,
                background: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{ color: '#555', fontSize: '12px' }}>Loading…</span>
              </div>
            )}
          </div>
          <p style={{
            color: 'var(--color-secondary)',
            fontSize: '12px',
            letterSpacing: '0.06em',
            textAlign: 'center',
            maxWidth: '200px',
          }}>
            Scan with your phone to log in
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 767px) {
          .qr-panel,
          .qr-divider {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}
