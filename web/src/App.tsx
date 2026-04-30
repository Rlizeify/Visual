import { useEffect, useState } from 'react'
import LoginPage from './components/LoginPage'
import VisualizerPage from './components/VisualizerPage'
import {
  handleCallback,
  isAuthenticated,
  hasRefreshToken,
  refreshToken,
  clearAuth,
  postSessionAuth,
  decodeSessionPayload,
} from './audio/SpotifyWebPlayer'

type Route = 'login' | 'callback' | 'visualizer'

// Localhost dev bypass — skip Spotify auth gate so we can test visuals locally
// without registering /callback in the Spotify dashboard. No effect on prod.
const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

function getRoute(): Route {
  const path = window.location.pathname
  if (path === '/callback') return 'callback'
  if (path === '/visualizer') return 'visualizer'
  if (isLocalhost) return 'visualizer'
  return 'login'
}

export default function App() {
  const [route, setRoute] = useState<Route>(getRoute)
  const [loading, setLoading] = useState(false)
  const [displayName, setDisplayName] = useState<string>('')

  // One-time session validation: if mheu_session exists but is malformed, force re-login.
  // If valid, extract display_name for the UI.
  useEffect(() => {
    const hasSession = !!localStorage.getItem('mheu_session')
    if (!hasSession) return
    const payload = decodeSessionPayload()
    if (!payload) {
      clearAuth()
      window.history.replaceState({}, '', '/')
      setRoute('login')
      return
    }
    setDisplayName(payload.display_name)
  }, [])

  useEffect(() => {
    // Handle OAuth callback
    if (route === 'callback') {
      setLoading(true)
      handleCallback().then(async token => {
        if (token) {
          await postSessionAuth(token)
          const payload = decodeSessionPayload()
          if (payload) setDisplayName(payload.display_name)
          window.history.replaceState({}, '', '/visualizer')
          setRoute('visualizer')
        } else {
          window.history.replaceState({}, '', '/')
          setRoute('login')
        }
        setLoading(false)
      })
    }
    // Redirect to visualizer if already authenticated
    else if (route === 'login' && isAuthenticated()) {
      window.history.replaceState({}, '', '/visualizer')
      setRoute('visualizer')
    }
    // Token expired but refresh token exists — silently refresh before showing login
    else if (route === 'login' && !isAuthenticated() && hasRefreshToken()) {
      setLoading(true)
      refreshToken().then(token => {
        if (token) {
          window.history.replaceState({}, '', '/visualizer')
          setRoute('visualizer')
        } else {
          clearAuth()
        }
        setLoading(false)
      })
    }
    // Redirect to login if not authenticated on visualizer (skipped on localhost)
    else if (route === 'visualizer' && !isAuthenticated() && !isLocalhost) {
      window.history.replaceState({}, '', '/')
      setRoute('login')
    }
  }, [route])

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      setRoute(getRoute())
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  if (loading) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        background: '#010103',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#eea91c',
        fontFamily: "'HitmarkerText', monospace",
      }}>
        Authenticating...
      </div>
    )
  }

  const handleLogout = () => {
    clearAuth()
    window.history.replaceState({}, '', '/')
    setRoute('login')
  }

  if (route === 'visualizer') {
    return <VisualizerPage onLogout={handleLogout} displayName={displayName} />
  }

  return <LoginPage />
}
