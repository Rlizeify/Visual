// Design tokens. Most colors reference CSS custom properties defined in
// tokens.css so per-user accent overrides flow through automatically.
export const colors = {
  tealPrimary: 'var(--accent-color)',
  bg:          'var(--color-bg)',
  panelBg:     'var(--color-panel-bg)',
  panelBorder: 'var(--accent-color-border)',
  secondary:   'var(--color-secondary)',
  error:       'var(--color-error)',
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
