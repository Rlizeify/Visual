import { useCallback, useRef, useState } from 'react'

interface DialProps {
  name: string
  min?: number
  max?: number
  defaultValue?: number
  unit?: string
  onChange?: (value: number) => void
}

// Map value [min, max] to rotation degrees [-135, +135]
function valueToAngle(value: number, min: number, max: number): number {
  const ratio = (value - min) / (max - min)
  return -135 + ratio * 270
}

export default function Dial({ name, min = 0, max = 100, defaultValue = 50, unit = '', onChange }: DialProps) {
  const [value, setValue] = useState(defaultValue)
  const dragStart = useRef<{ y: number; value: number } | null>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragStart.current = { y: e.clientY, value }

    const onMove = (ev: MouseEvent) => {
      if (!dragStart.current) return
      const delta = dragStart.current.y - ev.clientY   // up = positive
      const range = max - min
      const newVal = Math.min(max, Math.max(min, dragStart.current.value + (delta / 100) * range))
      const rounded = Math.round(newVal * 10) / 10
      setValue(rounded)
      onChange?.(rounded)
    }

    const onUp = () => {
      dragStart.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [value, min, max, onChange])

  const angle = valueToAngle(value, min, max)

  // Generate tick marks (13 ticks around 270° arc)
  const ticks = Array.from({ length: 13 }, (_, i) => {
    const tickAngle = -135 + (i / 12) * 270
    const r = 34   // radius to tick
    const len = i % 3 === 0 ? 7 : 4
    const rad = (tickAngle - 90) * (Math.PI / 180)
    const x1 = 40 + r * Math.cos(rad)
    const y1 = 40 + r * Math.sin(rad)
    const x2 = 40 + (r - len) * Math.cos(rad)
    const y2 = 40 + (r - len) * Math.sin(rad)
    return { x1, y1, x2, y2, major: i % 3 === 0 }
  })

  const displayValue = unit ? `${value}${unit}` : String(value)

  return (
    <div className="dial-wrap">
      <div className="dial" onMouseDown={handleMouseDown}>
        <svg
          viewBox="0 0 80 80"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
        >
          {/* Face */}
          <circle cx="40" cy="40" r="38" fill="url(#dialGrad)" stroke="rgba(0,207,255,0.3)" strokeWidth="2" />
          <defs>
            <radialGradient id="dialGrad" cx="35%" cy="35%">
              <stop offset="0%" stopColor="#1a1a3e" />
              <stop offset="100%" stopColor="#050510" />
            </radialGradient>
          </defs>

          {/* Ticks */}
          {ticks.map((t, i) => (
            <line
              key={i}
              x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke={t.major ? 'rgba(0,207,255,0.5)' : 'rgba(0,207,255,0.2)'}
              strokeWidth={t.major ? 1.5 : 1}
            />
          ))}

          {/* Arc track */}
          <path
            d="M 10.5 63.5 A 34 34 0 1 1 69.5 63.5"
            fill="none"
            stroke="rgba(0,207,255,0.1)"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Needle */}
          <g transform={`rotate(${angle}, 40, 40)`}>
            <line
              x1="40" y1="40"
              x2="40" y2="10"
              stroke="#00cfff"
              strokeWidth="2"
              strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 3px #00cfff)' }}
            />
          </g>

          {/* Center dot */}
          <circle cx="40" cy="40" r="4" fill="#00cfff" style={{ filter: 'drop-shadow(0 0 4px #00cfff)' }} />
        </svg>
      </div>
      <span className="dial__name">{name}</span>
      <span className="dial__value">{displayValue}</span>
    </div>
  )
}
