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
import { isAuthenticated as isSpotifyAuthenticated, hasRefreshToken, refreshToken, clearAuth } from './services/spotify/tokens'
import { setUserAndHydrate, subscribe as subscribeTokenEvents, type SpotifyTokenEvent } from './services/spotify/tokenStore'
import { postSessionAuth, decodeSessionPayload } from './services/spotify/session'
import { pingKeepalive } from './lib/keepalive'
import { ThemeProvider, useTheme } from './themes/ThemeContext'
import LoadingScreen from './components/LoadingScreen'

// Localhost dev bypass — skip auth gate so we can test visuals locally
const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

const MHEU_ROUTES = ['/m', '/h', '/e', '/u']
const GROOVY_BG_ROUTES = ['/login', '/signup', '/']
// Routes that own their own background — keep the regular viz/wave from leaking in.
const STANDALONE_BG_ROUTES = ['/admin', '/admin/login']

function AppRoutes() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, session, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(false)
  const [displayName, setDisplayName] = useState<string>('')

  const isMHEURoute = MHEU_ROUTES.includes(location.pathname)

  const [tokenBanner, setTokenBanner] = useState<string | null>(null)

  // Supabase keepalive — fires once per visit to prevent 7-day auto-pause.
  useEffect(() => { pingKeepalive() }, [])

  // Hydrate the Spotify tokenStore once we have a Supabase user.
  // Runs the legacy localStorage migration on first hit per session.
  useEffect(() => {
    if (!user?.id) return
    void setUserAndHydrate(user.id)
  }, [user?.id])

  // Surface non-blocking persistence errors. Tokens remain functional
  // in memory — the banner just tells the user re-link may be needed
  // on other devices.
  useEffect(() => {
    return subscribeTokenEvents((e: SpotifyTokenEvent) => {
      if (e.kind === 'save_failed') {
        setTokenBanner("Spotify tokens couldn't be saved to your account. They'll work for this session but you may need to re-link on other devices.")
      } else if (e.kind === 'refresh_invalid') {
        setTokenBanner('Your Spotify link expired. Please reconnect Spotify from the profile menu.')
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

  // Handle Supabase auth state changes
  useEffect(() => {
    if (authLoading) return

    // If user is authenticated with Supabase but needs Spotify connection
    if (session && location.pathname === '/login') {
      if (isSpotifyAuthenticated()) {
        navigate('/m', { replace: true })
      } else {
        navigate('/spotify-login', { replace: true })
      }
    }
  }, [session, authLoading, location.pathname, navigate])

  // Handle OAuth callback
  useEffect(() => {
    if (location.pathname === '/callback') {
      setLoading(true)
      handleCallback().then(async token => {
        if (token) {
          await postSessionAuth(token)
          const payload = decodeSessionPayload()
          if (payload) setDisplayName(payload.display_name)
          navigate('/m', { replace: true })
        } else {
          navigate('/login', { replace: true })
        }
        setLoading(false)
      })
    }
  }, [location.pathname, navigate])

  // Handle Spotify auth redirects
  useEffect(() => {
    if (location.pathname === '/spotify-login') {
      if (isSpotifyAuthenticated()) {
        navigate('/m', { replace: true })
      } else if (hasRefreshToken()) {
        setLoading(true)
        refreshToken().then(token => {
          if (token) navigate('/m', { replace: true })
          setLoading(false)
        })
      }
    }
  }, [location.pathname, navigate])

  // Protect MHEU routes
  useEffect(() => {
    if (isMHEURoute && !session && !isLocalhost) {
      navigate('/login', { replace: true })
    }
  }, [isMHEURoute, session, navigate])

  const handleLogout = () => {
    clearAuth()
    navigate('/login', { replace: true })
  }

  // Loading states — self-healing splash. See LoadingScreen.tsx for the
  // stage timeline (5s/15s/30s) and auto-recovery contract.
  if (authLoading || loading) {
    return <LoadingScreen />
  }

  // If we have a session and are about to render /login or /signup, render
  // the splash instead so the auth form never flashes for already-authed
  // users. Same self-healing behavior applies if a redirect somehow stalls.
  if (session && (location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/')) {
    return <LoadingScreen />
  }

  // Visualizer always mounted behind MHEU routes
  const isStandaloneBg = STANDALONE_BG_ROUTES.includes(location.pathname)
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
      <ThemeProvider>
        <ThemedApp />
      </ThemeProvider>
    </BrowserRouter>
  )
}
