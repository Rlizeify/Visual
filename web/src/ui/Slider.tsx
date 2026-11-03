// Range + number pair. Styled by .slider in features/visualizer/visualizer.css.

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
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
    <div className="slider">
      <span className="label slider__label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => commit(e.target.value)} aria-label={label} />
      <span className="slider__num">
        <input className="input" type="number" inputMode="decimal" min={min} max={max} step={step} value={value}
          onChange={e => commit(e.target.value)} aria-label={`${label} value`} />
        <span className="faint">{unit}</span>
      </span>
    </div>
  )
}
