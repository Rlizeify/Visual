import { useEffect, useState } from 'react'
import LoginPage from './components/LoginPage'
import VisualizerPage from './components/VisualizerPage'
import { handleCallback, isAuthenticated, hasRefreshToken, refreshToken, clearAuth } from './audio/SpotifyWebPlayer'

type Route = 'login' | 'callback' | 'visualizer'

function getRoute(): Route {
  const path = window.location.pathname
  if (path === '/callback') return 'callback'
  if (path === '/visualizer') return 'visualizer'
  return 'login'
}

export default function App() {
  const [route, setRoute] = useState<Route>(getRoute)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Handle OAuth callback
    if (route === 'callback') {
      setLoading(true)
      handleCallback().then(token => {
        if (token) {
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
    // Redirect to login if not authenticated on visualizer
    else if (route === 'visualizer' && !isAuthenticated()) {
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
    return <VisualizerPage onLogout={handleLogout} />
  }

  return <LoginPage />
}
