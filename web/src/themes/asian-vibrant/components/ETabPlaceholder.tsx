import type { CSSProperties } from 'react'

/**
 * E tab placeholder — same pattern as the H tab. The big calligraphic
 * glyph is 楽 ("music / enjoyment / ease"), evoking entertainment in
 * the East Asian sense without being culturally specific.
 */
export default function AsianVibrantETab() {
  const containerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 'calc(100vh - 80px)',
    padding: '40px 24px',
  }

  const cardStyle: CSSProperties = {
    maxWidth: '460px',
    padding: '48px 56px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
  }

  return (
    <div style={containerStyle}>
      <div className="av-paper-card" style={cardStyle}>
        <span style={{
          fontFamily: "'Ma Shan Zheng', serif",
          fontSize: '54px',
          color: 'var(--av-crimson-deep)',
          lineHeight: 1,
          letterSpacing: '0.1em',
        }}>
          楽
        </span>
        <h2 style={{
          fontFamily: "'Ma Shan Zheng', serif",
          fontSize: '28px',
          color: 'var(--av-ink)',
          fontWeight: 400,
          letterSpacing: '0.08em',
        }}>
          Entertainment
        </h2>
        <p style={{
          fontFamily: 'var(--av-font-body)',
          fontSize: '14px',
          color: 'var(--av-ink-soft)',
          lineHeight: 1.7,
          maxWidth: '360px',
        }}>
          Films, shows, and games — coming soon.
        </p>
        <div style={{
          marginTop: '8px',
          padding: '8px 22px',
          border: '1px solid var(--av-gold-deep)',
          color: 'var(--av-gold-deep)',
          fontFamily: 'var(--av-font-body)',
          fontSize: '11px',
          letterSpacing: '0.3em',
        }}>
          COMING SOON
        </div>
      </div>
    </div>
  )
}
