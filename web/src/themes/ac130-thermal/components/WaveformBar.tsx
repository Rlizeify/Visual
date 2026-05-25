import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useAudioSource } from '../../../audio/audioSource'
import { seek } from '../../../services/spotify/player'

/**
 * AC-130 Thermal — WaveformBar (white-hot thermal mode).
 *
 * Geometry contract identical to the other themes:
 *   - Anchored top: NAV_HEIGHT.
 *   - Idle = 5px flat line, active = 72px envelope.
 *   - 3s pointer debounce flushes back to idle.
 *   - Consumes useAudioSource() (single shared AnalyserNode).
 *   - Click-to-seek via Spotify seek().
 *
 * Visual: pure grayscale. The waveform is rendered as discrete
 * vertical bar segments (one per sample bucket), each filled with
 * a grayscale value proportional to its amplitude — so the bar
 * literally maps signal energy to thermal emission (cold→hot).
 * The active "WHOT" indicator sits top-right inside the bar.
 *
 * No tinted chrome anywhere — the bar is the thermal-IR moment of
 * the theme. The HUD phosphor frame around it is provided by the
 * outer 1px white border (theme.css .ac-thermal-bar).
 */

const NAV_HEIGHT = 56
const ACTIVE_HEIGHT = 72
const IDLE_HEIGHT = 5
const IDLE_DELAY_MS = 3000
const SMOOTH_WINDOW = 3

const VB_W = 1000
const VB_H = 100

function smooth(arr: number[]): number[] {
  if (arr.length < SMOOTH_WINDOW) return arr.slice()
  const out = new Array<number>(arr.length)
  const half = (SMOOTH_WINDOW - 1) >> 1
  for (let i = 0; i < arr.length; i++) {
    let sum = 0
    let n = 0
    for (let k = i - half; k <= i + half; k++) {
      if (k >= 0 && k < arr.length) { sum += arr[k]; n++ }
    }
    out[i] = sum / n
  }
  return out
}

/**
 * Map a 0..1 amplitude to a grayscale fill, "white-hot" mode:
 *   0    → pure black
 *   0.25 → dark gray
 *   0.5  → mid gray
 *   0.75 → light gray
 *   1.0  → pure white
 */
function thermalFill(a: number): string {
  const v = Math.max(0, Math.min(1, a))
  // Use a slight ease-out curve so quiet signals already show.
  const t = Math.pow(v, 0.75)
  const c = Math.round(t * 255)
  return `rgb(${c},${c},${c})`
}

export default function AC130ThermalWaveformBar() {
  const { waveform, position, duration, hasStream } = useAudioSource()
  const [active, setActive] = useState(false)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  function wake() {
    setActive(true)
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setActive(false), IDLE_DELAY_MS)
  }

  useEffect(() => () => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
  }, [])

  const progress = duration > 0 ? Math.max(0, Math.min(1, position / duration)) : 0
  const height = active ? ACTIVE_HEIGHT : IDLE_HEIGHT

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!containerRef.current || duration <= 0) return
    const rect = containerRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seek(ratio * duration * 1000)
  }

  const containerStyle: CSSProperties = {
    position: 'fixed',
    top: NAV_HEIGHT,
    left: 0,
    right: 0,
    height: `${height}px`,
    transition: 'height 350ms linear',
    cursor: duration > 0 ? 'pointer' : 'default',
    overflow: 'hidden',
    zIndex: 600,
  }

  const smoothed = active && hasStream && waveform.length > 0
    ? smooth(waveform)
    : []

  // Build vertical bar segments. Each sample becomes a stacked
  // rectangle whose fill grades from cold (bottom) to hot (top
  // of its own amplitude), giving a thermal "tower" feel.
  const bars: Array<{ x: number; w: number; h: number; fill: string }> = []
  if (smoothed.length > 0) {
    const n = smoothed.length
    const barW = VB_W / n
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, Math.min(1, smoothed[i]))
      const h = a * VB_H
      bars.push({
        x: i * barW,
        w: Math.max(1, barW - 0.5),
        h,
        fill: thermalFill(a),
      })
    }
  }

  // Played-position overlay: a thin white phosphor scrubline + amber
  // fill behind it. Amber is the only chromatic moment in the bar.
  const playedOverlayStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    width: `${progress * 100}%`,
    background: 'linear-gradient(90deg, rgba(255,176,0,0.0) 0%, rgba(255,176,0,0.10) 100%)',
    borderRight: '1px solid var(--ac-phosphor)',
    boxShadow: '0 0 6px rgba(255,255,255,0.45)',
    pointerEvents: 'none',
    transition: 'width 250ms linear',
  }

  return (
    <div
      ref={containerRef}
      className="ac-thermal-bar"
      style={containerStyle}
      onMouseEnter={wake}
      onMouseMove={wake}
      onClick={handleClick}
      title={duration > 0 ? 'Click to seek' : ''}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, display: 'block' }}
        aria-hidden
      >
        {/* Bars — drawn from bottom up so the brightest stays at peak. */}
        {bars.map((b, i) => (
          <rect
            key={i}
            x={b.x}
            y={VB_H - b.h}
            width={b.w}
            height={b.h}
            fill={b.fill}
          />
        ))}
        {/* Idle line: thin white stripe when collapsed. */}
        {!active && (
          <rect
            x={0}
            y={VB_H / 2 - 1}
            width={VB_W}
            height={2}
            fill="var(--ac-thermal-hot)"
            opacity={0.85}
          />
        )}
      </svg>

      {/* Played-position scrubline + fill. */}
      <div style={playedOverlayStyle} />

      {/* "WHOT" mode label, top-right. Only when active so it doesn't
          clutter the idle line. */}
      {active && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: '4px',
            right: '8px',
            fontFamily: 'var(--ac-font-mono)',
            fontSize: '9px',
            letterSpacing: '0.20em',
            color: 'var(--ac-phosphor)',
            textShadow: '0 0 4px rgba(255,255,255,0.55)',
            pointerEvents: 'none',
          }}
        >
          [ WHOT ]
        </span>
      )}
    </div>
  )
}
