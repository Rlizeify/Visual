import { useEffect, useState, type CSSProperties } from 'react'
import { useLocation, Outlet } from 'react-router-dom'
import { useTheme } from '../../ThemeContext'

/**
 * DashboardShell for Frutiger Aero.
 *
 * Renders the theme's NavBar + a fog overlay (visible on H/E/U, hidden
 * on M so the visualizer can show through) + the React Router outlet
 * with appropriate z-index and pointer-events handling.
 *
 * The Butterchurn visualizer is mounted separately at App root so it
 * persists across route changes; this shell coordinates with it via
 * pointer-events: none on the M-tab content slot.
 */
export default function FrutigerAeroDashboardShell() {
  const location = useLocation()
  const { theme } = useTheme()
  const NavBar = theme.components.NavBar

  const [activePath, setActivePath] = useState(location.pathname)
  useEffect(() => { setActivePath(location.pathname) }, [location.pathname])

  const showFog = activePath !== '/m'

  const fogStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'var(--aero-fog-bg, rgba(0, 20, 30, 0.6))',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    opacity: showFog ? 1 : 0,
    pointerEvents: showFog ? 'auto' : 'none',
    transition: 'opacity 300ms ease',
    zIndex: 50,
  }

  const contentStyle: CSSProperties = {
    position: 'relative',
    zIndex: showFog ? 100 : 1,
    paddingTop: '56px',
    width: '100%',
    height: '100%',
    overflow: showFog ? 'auto' : 'visible',
    pointerEvents: showFog ? 'auto' : 'none',
  }

  return (
    <>
      <div style={fogStyle} />
      <NavBar />
      <div style={contentStyle}>
        <Outlet />
      </div>
    </>
  )
}
