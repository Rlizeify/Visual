// Route group for /obsession/*. Wraps every child in:
//   - ThemeOverrideProvider (forces ac130-thermal on <html>)
//   - ObsessionLayout (HUD chrome, vignette, corner plates)
//
// Mount this once from App.tsx. The write surface (full-bleed timer)
// renders directly under ObsessionLayout but consumes 100vh via
// .obs-write-stage — the shell padding doesn't interfere because
// the stage is position: fixed.

import { Route, Routes } from 'react-router-dom'
import ThemeOverrideProvider from './ThemeOverrideProvider'
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
    <ThemeOverrideProvider id="ac130-thermal">
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
    </ThemeOverrideProvider>
  )
}
