import { useCallback, useEffect, useRef, useState } from 'react'

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
  const [isGrabbed, setIsGrabbed] = useState(false)
  const dialRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef(0)
  const startValueRef = useRef(0)

  // Window-level mousemove/mouseup for drag
  useEffect(() => {
    if (!isGrabbed) return

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startYRef.current - e.clientY // drag up = positive
      const newVal = Math.round(Math.min(max, Math.max(min, startValueRef.current + delta * 0.4)) * 10) / 10
      setValue(newVal)
      onChange?.(newVal)
    }

    const handleMouseUp = () => {
      setIsGrabbed(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isGrabbed, min, max, onChange])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    startYRef.current = e.clientY
    startValueRef.current = value
    setIsGrabbed(true)
  }, [value])

  // Wheel works whether grabbed or not — scroll up = increase
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const direction = Math.sign(e.deltaY) < 0 ? 1 : -1
    setValue(prev => {
      const newVal = Math.round(Math.min(max, Math.max(min, prev + direction * 1)) * 10) / 10
      onChange?.(newVal)
      return newVal
    })
  }, [min, max, onChange])

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
      <div
        ref={dialRef}
        className={`dial${isGrabbed ? ' dial-grabbed' : ''}`}
        style={{ cursor: isGrabbed ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
      >
        <svg
          viewBox="0 0 80 80"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
        >
          {/* Face — dark red-black with red outer ring */}
          <circle cx="40" cy="40" r="38" fill="url(#dialGrad)" stroke="#7a0105" strokeWidth="2" />
          <defs>
            <radialGradient id="dialGrad" cx="35%" cy="35%">
              <stop offset="0%" stopColor="#050107" />
              <stop offset="100%" stopColor="#010103" />
            </radialGradient>
          </defs>

          {/* Ticks */}
          {ticks.map((t, i) => (
            <line
              key={i}
              x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke={t.major ? 'rgba(122,1,5,0.6)' : 'rgba(122,1,5,0.25)'}
              strokeWidth={t.major ? 1.5 : 1}
            />
          ))}

          {/* Arc track */}
          <path
            d="M 10.5 63.5 A 34 34 0 1 1 69.5 63.5"
            fill="none"
            stroke="rgba(122,1,5,0.15)"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Needle — amber */}
          <g
            transform={`rotate(${angle}, 40, 40)`}
            style={{ transition: 'transform 0.1s ease' }}
          >
            <line
              x1="40" y1="40"
              x2="40" y2="10"
              stroke="#eea91c"
              strokeWidth="2"
              strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 3px #eea91c)' }}
            />
          </g>

          {/* Center dot — amber */}
          <circle cx="40" cy="40" r="4" fill="#eea91c" style={{ filter: 'drop-shadow(0 0 4px #eea91c)' }} />
        </svg>
      </div>
      <span className="dial__name">{name}</span>
      <span className="dial__value">{displayValue}</span>
    </div>
  )
}
