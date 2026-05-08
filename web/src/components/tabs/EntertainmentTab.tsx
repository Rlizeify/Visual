import type { CSSProperties } from 'react'
import '../MHEUShell.css'

export default function EntertainmentTab() {
  const containerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 'calc(100vh - 56px)',
    padding: '24px',
  }

  return (
    <div style={containerStyle}>
      <div className="glass-card coming-soon-card">
        <h2>Entertainment</h2>
        <p>
          Discover content, track your media consumption, and compete with friends
          on movies, shows, games, and more.
        </p>
        <div style={{
          marginTop: '24px',
          padding: '12px 24px',
          border: '1px solid rgba(0, 220, 200, 0.3)',
          borderRadius: '8px',
          color: 'rgba(180, 240, 235, 0.5)',
          fontSize: '12px',
          letterSpacing: '0.1em',
        }}>
          COMING SOON
        </div>
      </div>
    </div>
  )
}
