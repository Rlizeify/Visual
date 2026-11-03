// Root: exactly one of each provider, then the registry-driven shell.
// Pages live in src/app/routes.ts — not here.

import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProfileProvider } from './context/ProfileContext'
import Shell from './app/shell/Shell'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProfileProvider>
          <Shell />
        </ProfileProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
