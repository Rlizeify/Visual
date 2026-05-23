import type { CSSProperties } from 'react'
import { useTheme } from '../ThemeContext'

/**
 * AC-130 Thermal — stub shell. Mono-luminance "coming soon" plate with
 * scan-line overlay. Ignores children. Includes a back-button so users
 * picking this theme aren't stranded.
 */
export default function AC130ThermalShell() {
  const { setTheme } = useTheme()
  const wrap: CSSProperties = {
    position: 'fixed', inset: 0,
    background: '#0a0a0a',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px',
    padding: '24px', textAlign: 'center', zIndex: 9999,
    fontFamily: 'HitmarkerText, monospace',
  }
  const scanlines: CSSProperties = {
    position: 'absolute', inset: 0,
    backgroundImage: 'repeating-linear-gradient(to bottom, rgba(255,255,255,0.04) 0 1px, transparent 1px 3px)',
    pointerEvents: 'none',
  }
  return (
    <div style={wrap}>
      <div style={scanlines} />
      <div style={{ position: 'relative', fontSize: '11px', letterSpacing: '0.3em', color: 'rgba(255,255,255,0.6)' }}>
        [ FLIR / WH ]
      </div>
      <div style={{ position: 'relative', fontSize: '32px', fontWeight: 300, letterSpacing: '0.3em', color: '#ffffff' }}>
        AC-130 THERMAL
      </div>
      <div style={{ position: 'relative', fontSize: '13px', color: 'rgba(220,220,220,0.7)', letterSpacing: '0.15em' }}>
        Theme coming soon.
      </div>
      <button
        onClick={() => setTheme('frutiger-aero')}
        style={{
          position: 'relative',
          marginTop: '8px',
          padding: '10px 20px',
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.4)',
          color: '#ffffff',
          fontFamily: 'HitmarkerText, monospace',
          fontSize: '11px',
          letterSpacing: '0.12em',
          cursor: 'pointer',
        }}
      >
        BACK TO FRUTIGER AERO
      </button>
    </div>
  )
}
