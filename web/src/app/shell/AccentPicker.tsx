import { ACCENTS, ACCENT_LABELS, useAccent } from '../accent'

/** Three swatches. Works signed in (saves to profile) or as a guest (device only). */
export default function AccentPicker({ compact = false }: { compact?: boolean }) {
  const { accent, setAccent } = useAccent()
  return (
    <div className={`accent-picker${compact ? ' accent-picker--compact' : ''}`} role="radiogroup" aria-label="Accent color">
      {ACCENTS.map(a => (
        <button
          key={a}
          type="button"
          role="radio"
          aria-checked={accent === a}
          aria-label={ACCENT_LABELS[a]}
          title={ACCENT_LABELS[a]}
          className={`accent-swatch accent-swatch--${a}`}
          onClick={() => setAccent(a)}
        />
      ))}
    </div>
  )
}
