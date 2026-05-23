import type { CSSProperties } from 'react'
import { useTheme } from '../ThemeContext'

/**
 * Asian Vibrant — stub shell. Renders a centered "coming soon"
 * placeholder and intentionally ignores children so no part of the
 * Frutiger Aero presentation leaks through. Includes a back-button
 * so users picking this theme aren't stranded.
 */
export default function AsianVibrantShell() {
  const { setTheme } = useTheme()
  const wrap: CSSProperties = {
    position: 'fixed', inset: 0,
    background: 'radial-gradient(circle at 30% 20%, rgba(255,51,102,0.18), transparent 60%), radial-gradient(circle at 80% 80%, rgba(255,180,80,0.18), transparent 55%), #1a0a14',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px',
    padding: '24px', textAlign: 'center', zIndex: 9999,
  }
  return (
    <div style={wrap}>
      <div style={{ fontFamily: 'HitmarkerText, monospace', fontSize: '32px', fontWeight: 300, letterSpacing: '0.3em', color: '#ff5577', textShadow: '0 0 24px rgba(255,51,102,0.4)' }}>
        ASIAN VIBRANT
      </div>
      <div style={{ fontFamily: 'HitmarkerText, monospace', fontSize: '13px', color: 'rgba(255,220,240,0.7)', letterSpacing: '0.15em' }}>
        Theme coming soon.
      </div>
      <button
        onClick={() => setTheme('frutiger-aero')}
        style={{
          marginTop: '8px',
          padding: '10px 20px',
          background: 'transparent',
          border: '1px solid rgba(255,51,102,0.4)',
          color: '#ff5577',
          fontFamily: 'HitmarkerText, monospace',
          fontSize: '11px',
          letterSpacing: '0.12em',
          cursor: 'pointer',
          borderRadius: '8px',
        }}
      >
        BACK TO FRUTIGER AERO
      </button>
    </div>
  )
}
