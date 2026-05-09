import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Signup from './pages/Signup'
import SpotifyLoginPage from './features/spotify/LoginPage'
import VisualizerPage from './features/visualizer/VisualizerPage'
import MHEUShell from './components/MHEUShell'
import GroovyBackground from './components/GroovyBackground'
import AdminProtectedRoute from './components/AdminProtectedRoute'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import MusicTab from './components/tabs/MusicTab'
import HealthTab from './components/tabs/HealthTab'
import EntertainmentTab from './components/tabs/EntertainmentTab'
import UserCompetitionTab from './components/tabs/UserCompetitionTab'
import { handleCallback } from './services/spotify/auth'
import { isAuthenticated as isSpotifyAuthenticated, hasRefreshToken, refreshToken, clearAuth } from './services/spotify/tokens'
import { postSessionAuth, decodeSessionPayload } from './services/spotify/session'
import { colors } from './styles/tokens'

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

  // Loading states
  if (authLoading || loading) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: colors.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: colors.tealPrimary,
      }}>
        Authenticating...
      </div>
    )
  }

  // Visualizer always mounted behind MHEU routes
  const isStandaloneBg = STANDALONE_BG_ROUTES.includes(location.pathname)
  const showVisualizer =
    isMHEURoute ||
    (isLocalhost && !['/login', '/signup', '/spotify-login'].includes(location.pathname) && !isStandaloneBg)
  const showGroovyBg = !showVisualizer && GROOVY_BG_ROUTES.includes(location.pathname) && !isStandaloneBg

  return (
    <>
      {showGroovyBg && <GroovyBackground />}

      {/* Visualizer stays mounted at z-index 0 for MHEU routes */}
      {showVisualizer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
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

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
