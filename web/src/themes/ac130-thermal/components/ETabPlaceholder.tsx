import type { CSSProperties } from 'react'

/**
 * E tab placeholder for AC-130 Thermal.
 *
 * Same HUD-frame pattern as the H placeholder, different channel.
 * "ENTERTAINMENT — STANDBY" plate.
 */
export default function AC130ThermalETab() {
  const containerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 'calc(100vh - 80px)',
    padding: '40px 24px',
    fontFamily: 'var(--ac-font-mono)',
  }

  const cardStyle: CSSProperties = {
    maxWidth: '440px',
    padding: '40px 48px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
  }

  return (
    <div style={containerStyle}>
      <div className="ac-hud-frame ac-hud-frame--brackets" style={cardStyle}>
        <span style={{
          fontFamily: 'var(--ac-font-mono)',
          fontSize: '10px',
          color: 'var(--ac-hud-green-dim)',
          letterSpacing: '0.30em',
          textTransform: 'uppercase',
        }}>
          [ CH 03 / ENTMT ]
        </span>
        <h2 style={{
          fontFamily: 'var(--ac-font-mono)',
          fontSize: '22px',
          color: 'var(--ac-amber)',
          fontWeight: 700,
          letterSpacing: '0.30em',
          margin: 0,
          textShadow: '0 0 8px rgba(255, 176, 0, 0.50)',
        }}>
          ENTERTAINMENT — STANDBY
        </h2>
        <p style={{
          fontFamily: 'var(--ac-font-mono)',
          fontSize: '11px',
          color: 'var(--ac-hud-green-dim)',
          lineHeight: 1.7,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          margin: 0,
          maxWidth: '320px',
        }}>
          Books, films, and shows will feed through this channel.
          Goodreads / Letterboxd uplink not yet authorized.
        </p>
        <div style={{
          marginTop: '8px',
          padding: '6px 22px',
          border: '1px solid var(--ac-amber)',
          color: 'var(--ac-amber)',
          fontFamily: 'var(--ac-font-mono)',
          fontSize: '10px',
          letterSpacing: '0.30em',
          textShadow: '0 0 4px rgba(255, 176, 0, 0.40)',
        }}>
          [ STANDBY ]
        </div>
      </div>
    </div>
  )
}
