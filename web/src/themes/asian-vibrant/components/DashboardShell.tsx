import { useEffect, useState, type CSSProperties } from 'react'
import { useLocation, Outlet } from 'react-router-dom'
import { useTheme } from '../../ThemeContext'
import AsianVibrantDecorations from './Decorations'

/**
 * DashboardShell for Asian Vibrant.
 *
 * Same role as the Frutiger Aero DashboardShell — wraps NavBar + the
 * route Outlet — but replaces the fog overlay with the theme's
 * decorative stack (rice paper, ink mountains, kanji columns, petals,
 * dragon).
 *
 * The Butterchurn visualizer is mounted at App root and stays mounted
 * across route changes. On /m it sits at z-100 and dominates the screen;
 * the rice paper + mountains layers gate themselves to non-M routes so
 * they don't fight the visualizer. The kanji + petals + dragon stay
 * visible on all routes as ambient theme texture.
 */
export default function AsianVibrantDashboardShell() {
  const location = useLocation()
  const { theme } = useTheme()
  const NavBar = theme.components.NavBar

  const [activePath, setActivePath] = useState(location.pathname)
  useEffect(() => { setActivePath(location.pathname) }, [location.pathname])

  const showBackdrop = activePath !== '/m'

  const contentStyle: CSSProperties = {
    position: 'relative',
    zIndex: showBackdrop ? 100 : 1,
    paddingTop: '56px',
    width: '100%',
    height: '100%',
    overflow: showBackdrop ? 'auto' : 'visible',
    pointerEvents: showBackdrop ? 'auto' : 'none',
  }

  return (
    <>
      <AsianVibrantDecorations showBackdrop={showBackdrop} />
      <NavBar />
      <div style={contentStyle}>
        <Outlet />
      </div>
    </>
  )
}
