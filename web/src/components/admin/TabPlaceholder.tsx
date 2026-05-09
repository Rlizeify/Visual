import { palette, mono } from './theme'

export default function TabPlaceholder({ name }: { name: string }) {
  return (
    <div
      style={{
        border: `1px dashed ${palette.accentSubtle}`,
        padding: '32px 24px',
        textAlign: 'center',
        fontFamily: mono,
        color: palette.fgDim,
      }}
    >
      <div style={{ color: palette.accent, fontSize: 12, letterSpacing: '0.32em', marginBottom: 8 }}>
        {name}
      </div>
      <div style={{ fontSize: 12, letterSpacing: '0.08em' }}>
        wiring up — back shortly
      </div>
    </div>
  )
}
