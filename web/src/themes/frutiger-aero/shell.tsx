import type { ReactNode } from 'react'

/**
 * Frutiger Aero shell.
 *
 * Pass-through. The Frutiger Aero presentation is the existing app
 * chrome (visualizer behind, MHEU nav, glass cards, etc.) — there's
 * nothing extra to wrap around the routes. The shell exists for parity
 * with sibling themes that DO wrap (e.g. the stub themes render a
 * full-screen "coming soon" message and ignore children).
 */
export default function FrutigerAeroShell({ children }: { children: ReactNode }) {
  return <>{children}</>
}
