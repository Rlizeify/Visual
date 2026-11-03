// Route group for /obsession/*. Every child renders inside
// ObsessionLayout (HUD chrome, vignette, corner plates, fixed red).
//
// Lazy-loaded from the route registry (src/app/routes.ts) as its own chunk. The write surface (full-bleed timer)
// renders directly under ObsessionLayout but consumes 100vh via
// .obs-write-stage — the shell padding doesn't interfere because
// the stage is position: fixed.

import { Route, Routes } from 'react-router-dom'
import ObsessionLayout from './ObsessionLayout'
import Landing from './pages/Landing'
import Meditations from './pages/Meditations'
import MeditationsWrite from './pages/MeditationsWrite'
import Training from './pages/Training'
import Lifts from './pages/Lifts'
import LiftsLog from './pages/LiftsLog'
import Amor from './pages/Amor'
import Settings from './pages/Settings'

export default function ObsessionRoutes() {
  return (
    <Routes>
      <Route element={<ObsessionLayout />}>
        <Route index element={<Landing />} />
        <Route path="meditations" element={<Meditations />} />
        <Route path="meditations/write" element={<MeditationsWrite />} />
        <Route path="training" element={<Training />} />
        <Route path="lifts" element={<Lifts />} />
        <Route path="lifts/log" element={<LiftsLog />} />
        <Route path="amor" element={<Amor />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
