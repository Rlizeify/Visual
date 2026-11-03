// App shell: one NavBar, registry-driven routes, global listeners.

import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ROUTES, routeFor } from '../routes'
import { useAccentSync } from '../accent'
import { useSpotifySessionSync } from '../spotifySession'
import { useMouseIdle } from '../../shared/hooks/useMouseIdle'
import { useObsessionEgg } from './useObsessionEgg'
import NavBar from './NavBar'
import Gate from './Gate'
import LoadingScreen from '../../components/LoadingScreen'
import './shell.css'

const Login = lazy(() => import('../../pages/auth/Login'))
const Signup = lazy(() => import('../../pages/auth/Signup'))
const SpotifyLoginPage = lazy(() => import('../../features/spotify/LoginPage'))
const SpotifyCallback = lazy(() => import('../../features/spotify/SpotifyCallback'))

// Auth-flow pages: not in the registry (never in nav or on the landing
// page), but routed here. /admin/login now forwards to the shared login.
const AUTH_PATHS = ['/login', '/signup', '/spotify-login', '/callback']

export default function Shell() {
  const location = useLocation()
  const route = routeFor(location.pathname)
  const [banner, dismissBanner] = useSpotifySessionSync()
  const pointerActive = useMouseIdle(3000)
  useAccentSync()
  useObsessionEgg()

  useEffect(() => {
    const t = route && !route.hidden && route.path !== '/' ? `${route.title} · MHEU`
      : route?.hidden ? route.title
      : 'MHEU'
    document.title = t
  }, [route])

  const showNav = route ? route.chrome === 'nav' : AUTH_PATHS.includes(location.pathname)
  const onVisualizer = route?.path === '/m'

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      {banner && (
        <div role="status" className="banner">
          <span>{banner}</span>
          <button type="button" className="btn btn--sm" onClick={dismissBanner}>Dismiss</button>
        </div>
      )}
      {showNav && <NavBar faded={onVisualizer && !pointerActive} />}
      <div id="main">
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            {ROUTES.map(r => {
              const Page = r.component
              return <Route key={r.path} path={r.path} element={<Gate route={r}><Page /></Gate>} />
            })}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/spotify-login" element={<SpotifyLoginPage />} />
            <Route path="/callback" element={<SpotifyCallback />} />
            <Route path="/admin/login" element={<Navigate to="/login?next=%2Fadmin" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>
    </>
  )
}
