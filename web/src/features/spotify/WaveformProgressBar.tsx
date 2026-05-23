import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useAudioSource } from '../../audio/audioSource'
import { seek } from '../../services/spotify/player'

/**
 * Full-width waveform progress bar across the top of the M tab.
 *
 * Geometry: anchored to top:NAV_HEIGHT. Top edge is always flush with the
 * MHEU nav's bottom edge. The bar's height animates from IDLE_HEIGHT (5px)
 * up to ACTIVE_HEIGHT (72px) so it grows DOWNWARD into the content area
 * and shrinks UPWARD back to the nav.
 *
 * Renderer: SVG <path>, one closed shape per frame. The path traces the
 * top envelope of the audio waveform left-to-right, then the mirrored
 * bottom envelope right-to-left, closing back to the start. Catmull-Rom
 * smoothing converts the discrete sample points to cubic Bezier so there
 * are no visible vertical edges between samples.
 *
 * Source: `useAudioSource()` from T2 — same shared AnalyserNode that
 * powers Butterchurn + the gear-icon meter. 200 samples updated ~10Hz.
 *
 * Click: PUT /v1/me/player/seek?position_ms=... (requires Spotify Premium).
 */

const NAV_HEIGHT = 56
const ACTIVE_HEIGHT = 72
const IDLE_HEIGHT = 5
const IDLE_DELAY_MS = 3000
const SMOOTH_WINDOW = 3 // 3-sample moving average on rendered copy only

const GRAD_START = '#87150a'
const GRAD_END = '#eea91c'
const GRAD_ID = 'mheu-waveform-fill'

// SVG viewBox is virtual — width 1000, height 100 (centered on 50).
// Real pixel dimensions come from container width/height + preserveAspectRatio.
const VB_W = 1000
const VB_H = 100
const VB_CY = 50
const VB_HALF = 45 // leave 5px headroom top + bottom

/**
 * Catmull-Rom -> cubic Bezier. Returns SVG path commands for a smooth
 * polyline through `pts`. tension=0.5 gives a balanced curve.
 *
 * Pure: no DOM, no allocations beyond the returned string.
 */
function catmullRomPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`

  const out: string[] = [`M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`]
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    out.push(
      `C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
    )
  }
  return out.join(' ')
}

/** Light 3-tap moving average. Does NOT mutate input. */
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

/** Build the closed waveform path: top envelope, then bottom envelope. */
function buildWaveformPath(waveform: number[]): string {
  if (waveform.length === 0) return ''
  const smoothed = smooth(waveform)
  const n = smoothed.length
  const top: Array<{ x: number; y: number }> = []
  const bottom: Array<{ x: number; y: number }> = []
  for (let i = 0; i < n; i++) {
    const x = (i / Math.max(1, n - 1)) * VB_W
    const a = Math.max(0, Math.min(1, smoothed[i]))
    top.push({ x, y: VB_CY - a * VB_HALF })
    bottom.push({ x, y: VB_CY + a * VB_HALF })
  }
  // top L->R, then bottom R->L, close.
  const topPath = catmullRomPath(top)
  const bottomReversed = bottom.slice().reverse()
  // Continue the same path: line to start of bottom, then curves back.
  const bottomTail = catmullRomPath(bottomReversed).replace(/^M [\d.]+ [\d.]+/, 'L')
  return `${topPath} ${bottomTail} Z`
}

export default function WaveformProgressBar() {
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

  // Container is the actual hit/visual region. Its height animates so the
  // top edge stays pinned at NAV_HEIGHT and the bottom edge slides down.
  const containerStyle: CSSProperties = {
    position: 'fixed',
    top: NAV_HEIGHT,
    left: 0,
    right: 0,
    height: `${height}px`,
    transition: 'height 400ms ease',
    background: 'rgba(0, 0, 0, 0.35)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    borderBottom: '1px solid rgba(135, 21, 10, 0.4)',
    cursor: duration > 0 ? 'pointer' : 'default',
    fontFamily: "'HitmarkerText', monospace",
    overflow: 'hidden',
    zIndex: 600,
  }

  // Progress mask: a left-anchored band that exposes the gradient up to
  // `progress` of the width. Played portion is bright; remainder is dim.
  const playedOverlayStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    width: `${progress * 100}%`,
    background: `linear-gradient(90deg, ${GRAD_START}, ${GRAD_END})`,
    opacity: 0.55,
    pointerEvents: 'none',
    transition: 'width 250ms linear, opacity 400ms ease',
    mixBlendMode: 'multiply',
  }

  const pathD = active && hasStream && waveform.length > 0
    ? buildWaveformPath(waveform)
    : ''

  return (
    <div
      ref={containerRef}
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
        <defs>
          <linearGradient id={GRAD_ID} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={GRAD_START} />
            <stop offset="100%" stopColor={GRAD_END} />
          </linearGradient>
        </defs>
        {pathD && (
          <path
            d={pathD}
            fill={`url(#${GRAD_ID})`}
            opacity={0.9}
          />
        )}
        {/* Idle line: thin horizontal stripe centered when collapsed. */}
        {!active && (
          <rect
            x={0}
            y={VB_CY - 1}
            width={VB_W}
            height={2}
            fill={`url(#${GRAD_ID})`}
            opacity={0.7}
          />
        )}
      </svg>
      <div style={playedOverlayStyle} />
    </div>
  )
}
