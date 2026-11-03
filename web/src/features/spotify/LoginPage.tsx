// /spotify-login — link Spotify to the signed-in account. Desktop also
// shows a QR code so a phone can finish the consent screen.

import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { buildAuthUrl, type CallbackErrorReason } from '../../services/spotify/auth'
import { useAuth } from '../../context/AuthContext'
import { isSpotifyLinked, useSpotifyLink } from '../../app/spotifySession'
import LoadingScreen from '../../components/LoadingScreen'
import '../../pages/auth/auth.css'

const ERROR_COPY: Record<CallbackErrorReason, string> = {
  access_denied:         'You declined the Spotify permission prompt. Try again to continue.',
  state_mismatch:        'Something interfered with the sign-in (security check failed). Try again from this device.',
  missing_code:          'Sign-in state was lost between Spotify and this page. Try again.',
  token_exchange_failed: "Spotify couldn't complete the sign-in. Try again — if it keeps failing, the app may need to be reconnected.",
  network:               "Couldn't reach Spotify. Check your connection and try again.",
}

function isErrorReason(s: string | null): s is CallbackErrorReason {
  return s !== null && Object.prototype.hasOwnProperty.call(ERROR_COPY, s)
}

// QR codes need guaranteed light-on-dark contrast for phone cameras, so
// these two are fixed (the one sanctioned non-token pair, see AUDIT.md).
const QR_LIGHT = '#ffffff'
const QR_DARK = '#060608'

export default function LoginPage() {
  const { user, loading } = useAuth()
  const link = useSpotifyLink()
  const [authUrl, setAuthUrl] = useState<string | null>(null)
  const [params] = useSearchParams()
  const rawError = params.get('error')
  const errorReason = isErrorReason(rawError) ? rawError : null

  useEffect(() => { buildAuthUrl().then(setAuthUrl) }, [])

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login?next=%2Fspotify-login" replace />
  if (isSpotifyLinked(link)) return <Navigate to="/m" replace />

  return (
    <main className="page auth">
      <div className="container spotify-link">
        <section className="card auth__card">
          <p className="eyebrow">Visualizer</p>
          <h1 className="auth__title">Connect Spotify</h1>
          <p className="muted">
            The visualizer shows what you&apos;re playing and lets you control playback. MHEU never
            stores your Spotify password.
          </p>
          {errorReason && <p className="alert" role="alert">{ERROR_COPY[errorReason]}</p>}
          <button type="button" className="btn btn--spotify btn--block"
            onClick={() => { if (authUrl) window.location.href = authUrl }} disabled={!authUrl}>
            Continue with Spotify
          </button>
          <Link to="/" className="link-btn auth__alt">Not now</Link>
        </section>

        <section className="card spotify-link__qr" aria-label="Continue on your phone">
          <div className="spotify-link__code">
            {authUrl
              ? <QRCodeSVG value={authUrl} size={176} bgColor={QR_LIGHT} fgColor={QR_DARK} level="M" title="Spotify sign-in QR code" />
              : <span className="faint">Loading…</span>}
          </div>
          <p className="muted">Scan with your phone to finish signing in on this computer.</p>
        </section>
      </div>
    </main>
  )
}
