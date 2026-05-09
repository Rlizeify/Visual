// Shared visual tokens for the /admin terminal aesthetic.
// Match the same palette as web/src/pages/AdminLogin.tsx so the back-door
// look is consistent across login + dashboard + tabs.

export const palette = {
  bg: '#000000',
  panel: '#050505',
  panelAlt: '#0a0a0a',
  fg: '#d8d8d8',
  fgDim: '#7a7a7a',
  fgVeryDim: '#4a4a4a',
  accent: '#ff2d2d',
  accentDim: 'rgba(255, 45, 45, 0.6)',
  accentSubtle: 'rgba(255, 45, 45, 0.3)',
  accentFaint: 'rgba(255, 45, 45, 0.12)',
  ok: '#3aff7a',
  warn: '#ffb545',
  rowHover: 'rgba(255, 45, 45, 0.08)',
  rowStripe: 'rgba(255, 255, 255, 0.02)',
} as const

export const mono = "'Courier New', Consolas, ui-monospace, monospace" as const
