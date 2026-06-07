import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Signup from './pages/Signup'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import AdminProtectedRoute from './components/AdminProtectedRoute'
import SpotifyLoginPage from './features/spotify/LoginPage'
import VisualizerPage from './features/visualizer/VisualizerPage'
import MHEUShell from './components/MHEUShell'
import GroovyBackground from './components/GroovyBackground'
import MusicTab from './components/tabs/MusicTab'
import HealthTab from './components/tabs/HealthTab'
import EntertainmentTab from './components/tabs/EntertainmentTab'
import UserCompetitionTab from './components/tabs/UserCompetitionTab'
import { handleCallback } from './services/spotify/auth'
import { hasRefreshToken, refreshToken, clearAuth } from './services/spotify/tokens'
import { setUserAndHydrate, subscribe as subscribeTokenEvents, hasTokens, type SpotifyTokenEvent, type HydrationOutcome } from './services/spotify/tokenStore'
import { postSessionAuth, decodeSessionPayload } from './services/spotify/session'
// pingKeepalive moved to server-side cron (U14 — was leaking
// anon-key writes and exposing the keepalive row from the browser).
// The daily recompute cron now pings the heartbeat.
import { ThemeProvider, useTheme } from './themes/ThemeContext'
import { ProfileProvider } from './context/ProfileContext'
import LoadingScreen from './components/LoadingScreen'
import ObsessionRoutes from './features/obsession/ObsessionRoutes'
import { useObsessionEgg } from './features/obsession/useObsessionEgg'

// Localhost dev bypass — skip auth gate so we can test visuals locally
const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

const MHEU_ROUTES = ['/m', '/h', '/e', '/u']
const GROOVY_BG_ROUTES = ['/login', '/signup', '/']
// Routes that own their own background — keep the regular viz/wave from leaking in.
const STANDALONE_BG_ROUTES = ['/admin', '/admin/login']
// Obsession is a fully-self-contained subtree gated by the easter-egg
// listener. It owns its own theme + chrome + auth-implied access (the
// keypress only fires for signed-in users) and must NOT trigger the
// Spotify routing gate that bounces non-linked users to /spotify-login.
const isObsessionPath = (p: string) => p === '/obsession' || p.startsWith('/obsession/')

/**
 * Spotify hydration state machine. See
 * `.claude/memory/decisions/boot-sequence-contract.md` for the full
 * routing contract. tl;dr: AppRoutes must not decide where a signed-in
 * user lands until `spotifyHydration` leaves 'loading'.
 *   - 'idle'       — no signed-in user, nothing to load
 *   - 'loading'    — setUserAndHydrate in flight
 *   - 'linked'     — row loaded into mem
 *   - 'not-linked' — no row + no migratable legacy keys
 *   - 'error'      — Supabase down OR 8s timeout; treated as not-linked
 *                    for routing but raises a banner
 */
type SpotifyHydration = 'idle' | 'loading' | 'linked' | 'not-linked' | 'error'

function AppRoutes() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, session, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(false)
  const [spotifyHydration, setSpotifyHydration] = useState<SpotifyHydration>('idle')
  const [displayName, setDisplayName] = useState<string>('')

  const isMHEURoute = MHEU_ROUTES.includes(location.pathname)
  const isObsessionRoute = isObsessionPath(location.pathname)

  const [tokenBanner, setTokenBanner] = useState<string | null>(null)

  // Easter-egg listener — typing "obsession" navigates to /obsession.
  // Mounted unconditionally; the hook itself short-circuits when there
  // is no signed-in user.
  useObsessionEgg()

  // Hydrate the Spotify tokenStore once we have a Supabase user. The
  // routing decision below waits on `spotifyHydration` to leave
  // 'loading' before deciding whether to send the user to /m or
  // /spotify-login. Runs the legacy localStorage migration on first
  // hit per session.
  useEffect(() => {
    if (!user?.id) {
      setSpotifyHydration('idle')
      return
    }
    let cancelled = false
    setSpotifyHydration('loading')
    setUserAndHydrate(user.id)
      .then((outcome: HydrationOutcome) => {
        if (cancelled) return
        setSpotifyHydration(outcome)
      })
      .catch(err => {
        if (cancelled) return
        console.warn('[App] setUserAndHydrate threw (should be impossible):', err)
        setSpotifyHydration('error')
      })
    return () => { cancelled = true }
  }, [user?.id])

  // Surface non-blocking persistence errors. Tokens remain functional
  // in memory — the banner just tells the user re-link may be needed
  // on other devices.
  useEffect(() => {
    return subscribeTokenEvents((e: SpotifyTokenEvent) => {
      if (e.kind === 'save_failed') {
        setTokenBanner("Spotify tokens couldn't be saved to your account. They'll work for this session but you may need to re-link on other devices.")
      } else if (e.kind === 'refresh_invalid') {
        // VisualizerPage owns the inline reconnect pill — keep the user
        // on /m so it stays mounted. Flipping spotifyHydration here
        // would trigger the route gate and bounce them to
        // /spotify-login before the pill is visible (U15 finding).
        // Off-/m routes don't get the pill, so a fallback banner here
        // gives those users an obvious "reconnect" surface.
        setTokenBanner('Spotify connection expired. Reconnect from the profile menu or the Music tab.')
      } else if (e.kind === 'load_failed') {
        setTokenBanner("We couldn't reach Spotify token storage. You may need to reconnect to play music.")
      }
    })
  }, [])

  // Extract display name from session or Supabase user
  useEffect(() => {
    if (user?.user_metadata?.full_name) {
      setDisplayName(user.user_metadata.full_name)
    } else if (user?.email) {
      setDisplayName(user.email.split('@')[0])
    } else {
      const payload = decodeSessionPayload()
      if (payload) setDisplayName(payload.display_name)
    }
  }, [user])

  // Whether the boot splash should still be on screen. Covers:
  //   - Supabase auth hydrating (session not yet known)
  //   - Callback handler in flight
  //   - Spotify tokens still loading for a signed-in user
  // While true, AppRoutes paints LoadingScreen and the routing
  // decision effects below all bail early. This is the single source
  // of truth for "are we still booting?".
  const booting =
    authLoading ||
    loading ||
    (!!session && (spotifyHydration === 'idle' || spotifyHydration === 'loading'))

  // Whether the user has a usable Spotify link RIGHT NOW. Derived
  // from `mem` (synchronously populated by setUserAndHydrate when it
  // resolves 'linked'). `linked` from the state machine guarantees
  // hasTokens() returns true. Other outcomes do not — routing
  // assumes not-linked.
  const spotifyLinked = spotifyHydration === 'linked' && hasTokens()

  // Auth-aware route gate. Runs ONLY after boot completes, so we
  // never push the user through /spotify-login while we're still
  // loading their token row. Single decision point replaces three
  // racing effects from before this fix.
  useEffect(() => {
    if (booting) return

    // Not signed in — anything other than /login, /signup, /callback,
    // /admin/login, /admin should go to /login (production only; on
    // localhost we keep the dev bypass to /m). /obsession is also
    // signed-in-only and falls through to /login.
    if (!session && !isLocalhost) {
      const isPublicRoute =
        location.pathname === '/login' ||
        location.pathname === '/signup' ||
        location.pathname === '/callback' ||
        location.pathname === '/admin/login' ||
        location.pathname === '/admin'
      if (!isPublicRoute) {
        navigate('/login', { replace: true })
      }
      return
    }

    // Signed in. Hydration is settled (linked / not-linked / error).
    // /login, /signup, / go to /m if linked, /spotify-login otherwise.
    // /obsession is exempt from the Spotify gate — it does not depend
    // on tab audio or any Spotify state.
    if (isObsessionRoute) return
    if (session && (location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/')) {
      navigate(spotifyLinked ? '/m' : '/spotify-login', { replace: true })
      return
    }

    // Signed in, on /spotify-login, but tokens already loaded —
    // send to /m. Covers the returning-user case.
    if (session && location.pathname === '/spotify-login' && spotifyLinked) {
      navigate('/m', { replace: true })
      return
    }

    // Signed in, on /m|/h|/e|/u, but no Spotify link — bounce.
    if (session && isMHEURoute && !spotifyLinked) {
      navigate('/spotify-login', { replace: true })
      return
    }
  }, [booting, session, spotifyLinked, location.pathname, isMHEURoute, isObsessionRoute, navigate])

  // Handle OAuth callback
  useEffect(() => {
    if (location.pathname === '/callback') {
      setLoading(true)
      handleCallback().then(async result => {
        if (result.kind === 'ok') {
          await postSessionAuth(result.token)
          const payload = decodeSessionPayload()
          if (payload) setDisplayName(payload.display_name)
          // We just wrote tokens via setTokens() inside handleCallback —
          // promote state to 'linked' so the gate above lets us into /m.
          setSpotifyHydration('linked')
          navigate('/m', { replace: true })
        } else {
          // Send the user back to /spotify-login with a machine-readable
          // reason so the page can render a targeted retry banner instead
          // of silently bouncing to /login.
          navigate(`/spotify-login?error=${encodeURIComponent(result.reason)}`, { replace: true })
        }
        setLoading(false)
      })
    }
  }, [location.pathname, navigate])

  // Best-effort silent refresh when we land on /spotify-login WITH a
  // refresh_token in memory (rare: tokens row exists but access is
  // expired AND hydration outcome was 'linked'). The 'linked' outcome
  // already covers the common case via the gate above; this branch
  // only matters if the access token expired between hydrate and the
  // routing decision firing.
  useEffect(() => {
    if (booting) return
    if (location.pathname !== '/spotify-login') return
    if (spotifyLinked) return // gate effect handles it
    if (!hasRefreshToken()) return
    setLoading(true)
    refreshToken().then(token => {
      if (token) {
        setSpotifyHydration('linked')
        navigate('/m', { replace: true })
      }
      setLoading(false)
    })
  }, [booting, spotifyLinked, location.pathname, navigate])

  const handleLogout = () => {
    clearAuth()
    setSpotifyHydration('idle')
    navigate('/login', { replace: true })
  }

  // Loading states — self-healing splash. See LoadingScreen.tsx for the
  // stage timeline (5s/15s/30s) and auto-recovery contract. The
  // `booting` derived flag covers Supabase auth hydration, the OAuth
  // callback handler, and the Spotify tokens row load. Until all of
  // those resolve the splash stays put — no /spotify-login flash.
  if (booting) {
    return <LoadingScreen />
  }

  // If we have a session and are about to render a page that the
  // boot-decision effect is going to redirect away from, render the
  // splash instead so the destination route paints once and only once:
  //   - /login, /signup, / — always redirect for signed-in users
  //   - /spotify-login — only redirect when the link is live
  if (session) {
    if (location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/') {
      return <LoadingScreen />
    }
    if (location.pathname === '/spotify-login' && spotifyLinked) {
      return <LoadingScreen />
    }
  }

  // Visualizer always mounted behind MHEU routes
  const isStandaloneBg = STANDALONE_BG_ROUTES.includes(location.pathname) || isObsessionRoute
  const showVisualizer =
    isMHEURoute ||
    (isLocalhost && !['/login', '/signup', '/spotify-login'].includes(location.pathname) && !isStandaloneBg)
  const showGroovyBg = !showVisualizer && GROOVY_BG_ROUTES.includes(location.pathname) && !isStandaloneBg

  return (
    <>
      {tokenBanner && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 2000,
            background: 'rgba(135, 21, 10, 0.95)',
            color: '#fff',
            padding: '10px 16px',
            fontFamily: "'HitmarkerText', monospace",
            fontSize: '12px',
            letterSpacing: '0.04em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
          }}
        >
          <span>{tokenBanner}</span>
          <button
            onClick={() => setTokenBanner(null)}
            style={{
              background: 'transparent',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: '4px',
              padding: '4px 10px',
              fontFamily: 'inherit',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {showGroovyBg && <GroovyBackground />}

      {/* Visualizer stays mounted behind MHEU routes */}
      {showVisualizer && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: location.pathname === '/m' ? 100 : 0, // Above content (z-1) on M tab, behind fog (z-50) on others
        }}>
          <VisualizerPage
            onLogout={handleLogout}
            displayName={displayName}
            hideUI={location.pathname !== '/m'}
          />
        </div>
      )}

      <Routes>
        <Route path="/login" element={<Login onSwitchToSignup={() => navigate('/signup')} />} />
        <Route path="/signup" element={<Signup onSwitchToLogin={() => navigate('/login')} />} />
        <Route path="/spotify-login" element={<SpotifyLoginPage />} />
        <Route path="/callback" element={null} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <AdminProtectedRoute>
              <AdminDashboard />
            </AdminProtectedRoute>
          }
        />
        <Route element={<MHEUShell />}>
          <Route path="/m" element={<MusicTab />} />
          <Route path="/h" element={<HealthTab />} />
          <Route path="/e" element={<EntertainmentTab />} />
          <Route path="/u" element={<UserCompetitionTab />} />
        </Route>
        <Route path="/obsession/*" element={<ObsessionRoutes />} />
        <Route path="*" element={<Navigate to={isLocalhost ? '/m' : '/login'} replace />} />
      </Routes>
    </>
  )
}

/**
 * Theme-aware wrapper. The active theme's `shell` wraps the entire app.
 *
 * For Frutiger Aero this is a pass-through (children render). For stub
 * themes (Asian Vibrant, AC-130 Thermal) the shell renders a full-screen
 * "coming soon" plate and intentionally ignores `children`, so the
 * visualizer and routes do not mount while the stub is active.
 */
function ThemedApp() {
  const { theme } = useTheme()
  const Shell = theme.shell
  return <Shell><AppRoutes /></Shell>
}

export default function App() {
  return (
    <BrowserRouter>
      <ProfileProvider>
        <ThemeProvider>
          <ThemedApp />
        </ThemeProvider>
      </ProfileProvider>
    </BrowserRouter>
  )
}
