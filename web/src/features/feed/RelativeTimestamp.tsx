import { useEffect, useState, type CSSProperties } from 'react'

/**
 * Renders "13h ago" / "2m ago" / "just now". Re-evaluates every 30s so the
 * label stays current without a parent re-render. Smaller, dimmer text via
 * --color-secondary; no hardcoded color.
 */

function format(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'just now'
  const m = Math.floor(diff / 60_000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

const STYLE: CSSProperties = {
  color: 'var(--color-secondary)',
  fontSize: '11px',
  fontFamily: "'HitmarkerText', monospace",
  whiteSpace: 'nowrap',
  opacity: 0.65,
  flexShrink: 0,
}

export default function RelativeTimestamp({ iso }: { iso: string }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => tick(n => n + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])
  return <span style={STYLE}>{format(iso)}</span>
}
