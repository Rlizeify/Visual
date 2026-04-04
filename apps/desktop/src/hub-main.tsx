import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import HubApp from './components/hub/HubApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HubApp />
  </StrictMode>
)
