import { useEffect, useState, type CSSProperties } from 'react'
import { useLocation, Outlet } from 'react-router-dom'
import { useTheme } from '../../ThemeContext'
import AC130ThermalDecorations from './Decorations'

/**
 * DashboardShell for AC-130 Thermal.
 *
 * Same role as the Frutiger Aero shell: wraps NavBar + the route
 * Outlet. The fog overlay is replaced with the HUD decorations
 * stack (timestamps, coords, status, scan lines, vignette).
 *
 * On /m the visualizer is the field; decorations fade to ~20%
 * opacity so the HUD still frames the screen but the visualizer
 * dominates. On H/E/U the void backdrop + HUD chrome fully occupy
 * the screen.
 */
export default function AC130ThermalDashboardShell() {
  const location = useLocation()
  const { theme } = useTheme()
  const NavBar = theme.components.NavBar

  const [activePath, setActivePath] = useState(location.pathname)
  useEffect(() => { setActivePath(location.pathname) }, [location.pathname])

  const showOverlays = activePath !== '/m'

  // Void backdrop. On /m it's transparent so the visualizer shows
  // through; on H/E/U it's solid black, giving the HUD a clean field.
  const backdropStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: showOverlays ? 'var(--ac-void)' : 'transparent',
    zIndex: 30,
    pointerEvents: showOverlays ? 'auto' : 'none',
    transition: 'background 280ms linear',
  }

  const contentStyle: CSSProperties = {
    position: 'relative',
    zIndex: showOverlays ? 100 : 1,
    paddingTop: '56px',
    width: '100vw',
    minHeight: '100vh',
    overflow: 'visible',
    pointerEvents: showOverlays ? 'auto' : 'none',
    color: 'var(--ac-phosphor)',
    fontFamily: 'var(--ac-font-mono)',
  }

  return (
    <>
      <div style={backdropStyle} />
      <AC130ThermalDecorations showOverlays={showOverlays} />
      <NavBar />
      <div style={contentStyle}>
        <Outlet />
      </div>
    </>
  )
}
