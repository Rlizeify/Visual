import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import VisualizerApp from './components/display/VisualizerApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <VisualizerApp />
  </StrictMode>
)
