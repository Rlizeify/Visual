import type { CSSProperties } from 'react'

/**
 * E tab placeholder for Frutiger Aero.
 *
 * The AccountPage that previously lived here moved into the profile
 * dropdown (PART 2). The E tab is now a stub until the entertainment
 * tracking feature ships.
 */
export default function FrutigerAeroETab() {
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
        <p>Entertainment coming soon.</p>
      </div>
    </div>
  )
}
