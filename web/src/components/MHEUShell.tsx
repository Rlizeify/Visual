import { useTheme } from '../themes/ThemeContext'

/**
 * MHEUShell is a thin theme consumer. The actual shell chrome lives in
 * the active theme's `components.DashboardShell`. Frutiger Aero's shell
 * renders the original nav + fog + outlet. Stub themes never reach this
 * file because their theme `shell` wrapper intercepts at App root.
 */
export default function MHEUShell() {
  const { theme } = useTheme()
  const DashboardShell = theme.components.DashboardShell
  return <DashboardShell />
}
