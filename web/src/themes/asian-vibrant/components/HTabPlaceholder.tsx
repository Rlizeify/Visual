import type { CSSProperties } from 'react'

/**
 * H tab placeholder — a single deckled paper card with one big
 * calligraphic glyph (the panel's single kanji budget), a Latin
 * heading, and copy. No second kanji.
 */
export default function AsianVibrantHTab() {
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
          健
        </span>
        <h2 style={{
          fontFamily: 'var(--av-font-body)',
          fontSize: '24px',
          color: 'var(--av-ink)',
          fontWeight: 600,
          letterSpacing: '0.04em',
          margin: 0,
        }}>
          Health
        </h2>
        <p style={{
          fontFamily: 'var(--av-font-body)',
          fontSize: '14px',
          color: 'var(--av-ink-soft)',
          lineHeight: 1.7,
          maxWidth: '360px',
          margin: 0,
        }}>
          Wellness, nutrition, and movement scores will live here.
          MyNetDiary, Apple Health, and more — all flowing through
          the same Life Score curve as music.
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
