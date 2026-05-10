import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './context/AuthContext'
import App from './App'
import { applyAccentColor, loadCachedAccentColor } from './lib/accentColor'
import './styles/global.css'

// Apply cached accent before first paint so the loading screen matches the user.
const cached = loadCachedAccentColor()
if (cached) applyAccentColor(cached)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
)
