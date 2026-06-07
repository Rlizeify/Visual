import type { CSSProperties } from 'react'
import { colors, fonts } from '../styles/tokens'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
}

const labelStyle: CSSProperties = {
  width: 90,
  fontSize: 11,
  color: colors.tealPrimary,
  fontFamily: fonts.ui,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  flexShrink: 0,
}

const inputStyle: CSSProperties = {
  width: 52,
  background: 'rgba(0, 20, 30, 0.8)',
  border: `1px solid ${colors.panelBorder}`,
  color: colors.tealPrimary,
  fontSize: 11,
  fontFamily: fonts.ui,
  textAlign: 'right',
  padding: '2px 4px',
  borderRadius: 0,
}

const unitStyle: CSSProperties = {
  fontSize: 10,
  color: colors.secondary,
  minWidth: 16,
  fontFamily: fonts.ui,
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

export default function Slider({ label, value, min, max, step, unit, onChange }: SliderProps) {
  // Shared parse+clamp. Range inputs effectively never emit NaN, but
  // the number input could, and routing both through one guard means
  // neither path can poison upstream visualizer state.
  const commit = (raw: string) => {
    const v = parseFloat(raw)
    if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)))
  }
  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => commit(e.target.value)}
        style={{ flex: 1, height: 3, cursor: 'pointer', accentColor: colors.tealPrimary }}
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => commit(e.target.value)}
        style={inputStyle}
      />
      <span style={unitStyle}>{unit}</span>
    </div>
  )
}
