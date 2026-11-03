// Shared shell for every /obsession/* route.
//
// Renders the persistent HUD chrome (corner plates, vignette,
// scan lines, grid overlay) and frames the route children inside a
// max-width container. `.accent-red` pins the red system regardless of
// the user's accent; obsession.css defines the HUD tokens.

import type { ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import HudCorners from './components/HudCorners'
import './obsession.css'

interface Props {
  /** When passed, renders this content. Otherwise renders <Outlet />
   *  so the layout doubles as a route element. */
  children?: ReactNode
}

export default function ObsessionLayout({ children }: Props) {
  return (
    <div className="obs-root accent-red">
      <div className="obs-vignette" />
      <HudCorners />
      <div className="obs-shell">{children ?? <Outlet />}</div>
    </div>
  )
}
