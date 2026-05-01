export const colors = {
  tealPrimary: '#00dcc8',
  bg:          '#010103',
  panelBg:     'rgba(0, 20, 30, 0.55)',
  panelBorder: 'rgba(0, 220, 200, 0.4)',
  secondary:   'rgba(180, 240, 235, 0.7)',
  error:       'rgba(255, 100, 100, 0.85)',
} as const

export const fonts = {
  ui:   "'HitmarkerText', monospace",
  mono: 'monospace',
} as const

export const panel = {
  background:     colors.panelBg,
  backdropFilter: 'blur(12px)',
  border:         `1px solid ${colors.panelBorder}`,
  borderRadius:   8,
} as const
