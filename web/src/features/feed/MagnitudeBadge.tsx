import type { CSSProperties } from 'react'
import type { MagnitudeInfo } from './eventCopy'

/**
 * Pill badge showing a signed delta. Green for positive, red for negative,
 * dim for zero. All colors flow through CSS variables defined in
 * web/src/styles/tokens.css — no hardcoded hex here.
 */

const BASE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'baseline',
  padding: '1px 6px',
  borderRadius: '4px',
  fontFamily: "'HitmarkerText', monospace",
  fontSize: '11px',
  fontWeight: 600,
  lineHeight: 1.3,
  letterSpacing: '0.02em',
  flexShrink: 0,
}

export default function MagnitudeBadge({ info }: { info: MagnitudeInfo }) {
  let style: CSSProperties
  if (info.sign === 'pos') {
    style = {
      ...BASE,
      color: 'var(--color-success)',
      background: 'var(--color-success-bg)',
      border: '1px solid var(--color-success-border)',
    }
  } else if (info.sign === 'neg') {
    style = {
      ...BASE,
      color: 'var(--color-danger)',
      background: 'var(--color-danger-bg)',
      border: '1px solid var(--color-danger-border)',
    }
  } else {
    style = {
      ...BASE,
      color: 'var(--color-secondary)',
      background: 'transparent',
      border: '1px solid var(--accent-color-border)',
    }
  }
  return (
    <span style={style}>
      {info.value}
      {info.suffix && <span style={{ marginLeft: '1px' }}>{info.suffix}</span>}
    </span>
  )
}
