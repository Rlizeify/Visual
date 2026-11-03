// Admin console palette — every value is a design token, so the admin
// follows the global dark theme and the user's accent.

export const palette = {
  bg: 'var(--surface-0)',
  panel: 'var(--surface-1)',
  panelAlt: 'var(--surface-2)',
  fg: 'var(--text-primary)',
  fgDim: 'var(--text-secondary)',
  fgVeryDim: 'var(--text-muted)',
  accent: 'var(--accent-text)',
  accentDim: 'var(--accent-border)',
  accentSubtle: 'var(--border-strong)',
  accentFaint: 'var(--accent-weak)',
  ok: 'var(--success)',
  warn: 'var(--warning)',
  rowHover: 'var(--surface-3)',
  rowStripe: 'var(--surface-1)',
} as const

export const mono = 'var(--font-sans)' as const
