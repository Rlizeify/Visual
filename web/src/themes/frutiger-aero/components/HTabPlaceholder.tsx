import type { CSSProperties } from 'react'

export default function FrutigerAeroHTab() {
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
        <h2>Health</h2>
        <p>
          Track your wellness metrics, nutrition data, and health scores.
          Connect MyNetDiary, Apple Health, and more.
        </p>
        <div style={{
          marginTop: '24px',
          padding: '12px 24px',
          border: '1px solid var(--accent-color-border)',
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
