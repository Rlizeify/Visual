import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import './styles/cockpit.css'
import './styles/fonts.css'
import CockpitApp from './components/cockpit/CockpitApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CockpitApp />
  </StrictMode>
)
