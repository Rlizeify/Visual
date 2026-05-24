import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useAudioSource } from '../../../audio/audioSource'
import { seek } from '../../../services/spotify/player'

/**
 * Asian Vibrant waveform progress bar.
 *
 * Same geometry contract as the Frutiger Aero version:
 *   - Anchored top:NAV_HEIGHT, flush with the lacquer band's bottom edge.
 *   - Idle = 5px flat line, active = 72px brushstroke envelope, 3s pointer
 *     debounce flushes back to idle.
 *   - Consumes useAudioSource() from the single shared AnalyserNode.
 *   - Click-to-seek via Spotify seek().
 *
 * The visual differences:
 *   - Background: a thin rice-paper band with a fine ink underline.
 *   - Fill: crimson -> gold ink-on-paper gradient, painted through a
 *     subtle Gaussian feather so peaks have brushstroke softness.
 *   - Played overlay: deepens to wet-ink crimson, multiply blend.
 */

const NAV_HEIGHT = 56
const ACTIVE_HEIGHT = 72
const IDLE_HEIGHT = 5
const IDLE_DELAY_MS = 3000
const SMOOTH_WINDOW = 3

const GRAD_START = '#a31a0c' // crimson-deep
const GRAD_MID = '#c33524'   // vermillion
const GRAD_END = '#c9a227'   // gold-deep
const GRAD_ID = 'av-waveform-fill'
const FEATHER_ID = 'av-waveform-feather'

const VB_W = 1000
const VB_H = 100
const VB_CY = 50
const VB_HALF = 45

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
  const topPath = catmullRomPath(top)
  const bottomReversed = bottom.slice().reverse()
  const bottomTail = catmullRomPath(bottomReversed).replace(/^M [\d.]+ [\d.]+/, 'L')
  return `${topPath} ${bottomTail} Z`
}

export default function AsianVibrantWaveformBar() {
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
    transition: 'height 400ms ease',
    // Thin rice-paper backdrop with a hairline gold underline
    background:
      'linear-gradient(180deg, rgba(244,236,216,0.85) 0%, rgba(232,222,195,0.78) 100%)',
    borderBottom: '1px solid var(--av-gold-deep)',
    cursor: duration > 0 ? 'pointer' : 'default',
    overflow: 'hidden',
    zIndex: 600,
  }

  const playedOverlayStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    width: `${progress * 100}%`,
    background:
      'linear-gradient(90deg, rgba(163,26,12,0.55), rgba(195,53,36,0.45))',
    pointerEvents: 'none',
    transition: 'width 250ms linear',
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
            <stop offset="55%" stopColor={GRAD_MID} />
            <stop offset="100%" stopColor={GRAD_END} />
          </linearGradient>
          <filter id={FEATHER_ID} x="-2%" y="-10%" width="104%" height="120%">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
        </defs>
        {pathD && (
          <path
            d={pathD}
            fill={`url(#${GRAD_ID})`}
            opacity={0.92}
            filter={`url(#${FEATHER_ID})`}
          />
        )}
        {/* Idle line: thin horizontal ink stripe when collapsed. */}
        {!active && (
          <rect
            x={0}
            y={VB_CY - 1}
            width={VB_W}
            height={2}
            fill={`url(#${GRAD_ID})`}
            opacity={0.85}
          />
        )}
      </svg>
      <div style={playedOverlayStyle} />
    </div>
  )
}
