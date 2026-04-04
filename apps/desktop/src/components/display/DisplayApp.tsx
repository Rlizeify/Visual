import { useEffect, useState, useRef, useCallback } from 'react'
import Visualizer from './Visualizer'

/* ── Deterministic building data ─────────────────────────────────────────── */

interface Building {
  x: number
  width: number
  height: number
  windows: { wx: number; wy: number; lit: boolean; color: string; opacity: number }[]
}

function generateBuildings(): Building[] {
  const buildings: Building[] = []
  let x = -2
  const seed = [
    { w: 54, h: 38 }, { w: 40, h: 62 }, { w: 60, h: 45 }, { w: 36, h: 80 },
    { w: 50, h: 55 }, { w: 44, h: 72 }, { w: 58, h: 40 }, { w: 38, h: 90 },
    { w: 52, h: 48 }, { w: 46, h: 65 }, { w: 42, h: 58 }, { w: 56, h: 35 },
    { w: 48, h: 76 }, { w: 60, h: 42 }, { w: 34, h: 68 }, { w: 50, h: 52 },
    { w: 44, h: 85 }, { w: 62, h: 38 }, { w: 40, h: 60 }, { w: 54, h: 70 },
    { w: 46, h: 44 }, { w: 38, h: 78 }, { w: 58, h: 50 }, { w: 42, h: 62 },
  ]

  // Pseudo-random based on index
  const pr = (i: number) => ((i * 7919 + 104729) % 100) / 100

  for (let i = 0; i < seed.length; i++) {
    const { w, h } = seed[i]
    const gap = 1 + (i % 3)
    const bx = x + gap
    const windows: Building['windows'] = []
    const cols = Math.floor((w - 8) / 10)
    const rows = Math.floor((h - 6) / 10)
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = i * 100 + row * 20 + col
        const lit = pr(idx) > 0.45
        const isTeal = pr(idx + 7) > 0.7
        windows.push({
          wx: 5 + col * 10,
          wy: 4 + row * 10,
          lit,
          color: isTeal ? '#00ffcc' : '#ffb347',
          opacity: lit ? (isTeal ? 0.2 + pr(idx + 3) * 0.2 : 0.3 + pr(idx + 5) * 0.4) : 0,
        })
      }
    }
    buildings.push({ x: bx, width: w, height: h, windows })
    x = bx + w
  }
  return buildings
}

const BUILDINGS = generateBuildings()

/* ── Flickering window indices (deterministic picks) ─────────────────────── */
const FLICKER_INDICES = [
  { bIdx: 3, wIdx: 2 },
  { bIdx: 7, wIdx: 5 },
  { bIdx: 11, wIdx: 1 },
  { bIdx: 16, wIdx: 3 },
  { bIdx: 20, wIdx: 4 },
  { bIdx: 5, wIdx: 7 },
]

/* ── Component ───────────────────────────────────────────────────────────── */

export default function DisplayApp() {
  const [introDone, setIntroDone] = useState(false)
  const [time, setTime] = useState(formatTime())
  const [showVisualizer, setShowVisualizer] = useState(false)
  const [vizOpacity, setVizOpacity] = useState(0)
  const introRef = useRef<HTMLDivElement>(null)
  const hasReceivedBeat = useRef(false)

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTime(formatTime()), 1000)
    return () => clearInterval(t)
  }, [])

  // Intro → idle transition
  useEffect(() => {
    const timer = setTimeout(() => setIntroDone(true), 3200)
    return () => clearTimeout(timer)
  }, [])

  // Listen for beat data — crossfade to visualizer when playing
  useEffect(() => {
    const api = (window as any).api
    if (!api?.onBeatData) return
    api.onBeatData((data: any) => {
      if (data.isPlaying && !hasReceivedBeat.current) {
        hasReceivedBeat.current = true
        setShowVisualizer(true)
        // Fade in over 1 second
        requestAnimationFrame(() => setVizOpacity(1))
      } else if (!data.isPlaying && hasReceivedBeat.current) {
        hasReceivedBeat.current = false
        setVizOpacity(0)
        setTimeout(() => setShowVisualizer(false), 1000)
      }
    })
    return () => { if (api?.removeBeatDataListeners) api.removeBeatDataListeners() }
  }, [])

  const viewBox = `0 0 1200 100`

  return (
    <div className="display-root" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      {/* ── Intro overlay ──────────────────────────────────────────────── */}
      {!introDone && (
        <div ref={introRef} className="intro-overlay">
          <span className="intro-title">VISUAL</span>
        </div>
      )}

      {/* ── City idle scene ────────────────────────────────────────────── */}
      <div className={`idle-scene ${introDone ? 'idle-visible' : ''}`}>
        {/* Sky */}
        <div className="sky" />

        {/* City skyline SVG */}
        <svg
          className="skyline-svg"
          viewBox={viewBox}
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {BUILDINGS.map((b, i) => (
            <g key={i}>
              <rect
                x={b.x}
                y={100 - b.height}
                width={b.width}
                height={b.height}
                fill="#0a0012"
              />
              {b.windows.map((w, j) => {
                const isFlicker = FLICKER_INDICES.some(
                  (f) => f.bIdx === i && f.wIdx === j
                )
                return w.lit ? (
                  <rect
                    key={j}
                    x={b.x + w.wx}
                    y={100 - b.height + w.wy}
                    width={5}
                    height={6}
                    fill={w.color}
                    opacity={w.opacity}
                    className={isFlicker ? `flicker-window flicker-${FLICKER_INDICES.findIndex((f) => f.bIdx === i && f.wIdx === j) % 3}` : undefined}
                  />
                ) : null
              })}
            </g>
          ))}
        </svg>

        {/* Light streaks (road) */}
        <div className="light-streaks">
          <div className="streak streak-1" />
          <div className="streak streak-2" />
          <div className="streak streak-3" />
        </div>

        {/* Center overlay text */}
        <div className="idle-center">
          <h1 className="idle-title">VISUAL</h1>
          <p className="idle-standby">STANDBY</p>
        </div>

        {/* Clock */}
        <div className="idle-clock">{time}</div>
      </div>

      {/* ── Visualizer overlay ───────────────────────────────────────── */}
      {showVisualizer && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            opacity: vizOpacity,
            transition: 'opacity 1s ease-in-out',
            zIndex: 10,
          }}
        >
          <Visualizer />
        </div>
      )}
    </div>
  )
}

function formatTime(): string {
  const d = new Date()
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}
