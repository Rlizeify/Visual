import type { CSSProperties } from 'react'

/**
 * Circular avatar with the user's accent color as border. Falls back to
 * a tinted letter circle when avatar_url is null.
 *
 * Per-row accents (other users' colors) come straight from
 * event.accent_color (hex from public.profiles), NOT from CSS variables —
 * so each row paints its owner's color regardless of the viewer's accent.
 * When accent_color is null we fall back to the viewer's --accent-color.
 */

interface Props {
  username: string
  avatarUrl?: string | null
  accentColor?: string | null
  size?: number
  glow?: boolean
}

// Convert hex (#aabbcc) → rgba string with alpha. Returns the fallback
// CSS string if hex is missing or malformed (e.g. event.accent_color is null).
function hexToRgba(hex: string | null | undefined, alpha: number, fallback: string): string {
  if (!hex) return fallback
  const h = hex.trim().replace(/^#/, '')
  if (h.length !== 6) return fallback
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  if ([r, g, b].some(n => Number.isNaN(n))) return fallback
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default function FeedAvatar({
  username,
  avatarUrl,
  accentColor,
  size = 44,
  glow = false,
}: Props) {
  const border = accentColor || 'var(--accent-color)'
  const tint = hexToRgba(accentColor, 0.18, 'var(--accent-color-bg)')
  const glowColor = hexToRgba(accentColor, 0.55, 'var(--accent-color-glow)')
  const letter = (username || '?')[0].toUpperCase()

  const containerStyle: CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    minWidth: `${size}px`,
    borderRadius: '50%',
    border: `2px solid ${border}`,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: avatarUrl ? 'rgba(0, 0, 0, 0.3)' : tint,
    boxShadow: glow ? `0 0 12px ${glowColor}` : 'none',
    transition: 'box-shadow 200ms ease',
    flexShrink: 0,
  }

  if (avatarUrl) {
    return (
      <div style={containerStyle}>
        <img
          src={avatarUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <span style={{
        color: border,
        fontFamily: "'HitmarkerText', monospace",
        fontSize: `${Math.round(size * 0.42)}px`,
        fontWeight: 700,
        lineHeight: 1,
      }}>{letter}</span>
    </div>
  )
}
