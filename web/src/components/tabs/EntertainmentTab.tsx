import type { CSSProperties } from 'react'
import { useAuth } from '../../context/AuthContext'
import AccountPage from './AccountPage'
import '../MHEUShell.css'

export default function EntertainmentTab() {
  const { session } = useAuth()
  const isAuthenticated = !!session

  const containerStyle: CSSProperties = {
    padding: 'clamp(16px, 4vw, 32px)',
    maxWidth: '1280px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  }

  return (
    <div style={containerStyle}>
      {/* Entertainment disclaimer - always visible */}
      <div className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: 600,
          color: '#00dcc8',
          marginBottom: '8px',
          fontFamily: "'HitmarkerText', monospace",
        }}>
          Entertainment
        </h2>
        <p style={{
          fontSize: '13px',
          color: 'rgba(180, 240, 235, 0.6)',
          maxWidth: '400px',
          margin: '0 auto 12px',
          lineHeight: 1.5,
        }}>
          Discover content, track your media consumption, and compete with friends
          on movies, shows, games, and more.
        </p>
        <div style={{
          display: 'inline-block',
          padding: '8px 20px',
          border: '1px solid rgba(0, 220, 200, 0.3)',
          borderRadius: '6px',
          color: 'rgba(180, 240, 235, 0.5)',
          fontSize: '11px',
          letterSpacing: '0.1em',
        }}>
          EXPANDING IN THE FUTURE
        </div>
      </div>

      {/* Account section - only for authenticated users */}
      {isAuthenticated && <AccountPage />}
    </div>
  )
}
