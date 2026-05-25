import type { CSSProperties } from 'react'

/**
 * H tab placeholder for AC-130 Thermal.
 *
 * Centered HUD frame reading "HEALTH — OFFLINE". Mimics the
 * "subsystem offline" plates that appear on the gunship trainer
 * when a sensor channel is unavailable.
 */
export default function AC130ThermalHTab() {
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
          color: 'var(--ac-phosphor-dim)',
          letterSpacing: '0.30em',
          textTransform: 'uppercase',
        }}>
          [ CH 02 / HEALTH ]
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
          HEALTH — OFFLINE
        </h2>
        <p style={{
          fontFamily: 'var(--ac-font-mono)',
          fontSize: '11px',
          color: 'var(--ac-phosphor-dim)',
          lineHeight: 1.7,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          margin: 0,
          maxWidth: '320px',
        }}>
          Wellness, nutrition, and movement feeds will route
          through this channel. Awaiting MyNetDiary / Apple Health
          uplink.
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
