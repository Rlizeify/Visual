import type { ReactNode } from 'react'

/**
 * AC-130 Thermal shell.
 *
 * Pass-through. Like Frutiger Aero and Asian Vibrant, the entire
 * presentation is delivered through DashboardShell + per-surface
 * components; the shell itself just hosts the route tree.
 *
 * The previous stub overlay (full-screen "coming soon" splash with
 * the back-to-Frutiger-Aero button) is archived at
 * web/src/archive/ac130-thermal-stub/.
 */
export default function AC130ThermalShell({ children }: { children: ReactNode }) {
  return <>{children}</>
}
