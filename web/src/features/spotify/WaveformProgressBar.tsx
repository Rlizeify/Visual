import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useAudioSource } from '../../audio/audioSource'
import { seek } from '../../services/spotify/player'

/**
 * Full-width waveform progress bar that sits across the top of the M tab,
 * just below the MHEU nav (which is 56px tall).
 *
 * Active state: peaks rendered 60-80px tall from the live audio waveform.
 * Idle state:   collapses to a 5px flat line 3 seconds after the last
 *               pointer activity over the bar. Hover wakes it back up.
 *
 * Fill: red->orange linear gradient driven by `position / duration`.
 * Click: PUT /v1/me/player/seek?position_ms=... (Spotify Premium required).
 */

const NAV_HEIGHT = 56
const ACTIVE_HEIGHT = 72
const IDLE_HEIGHT = 5
const IDLE_DELAY_MS = 3000

// Red -> orange ramp. Bar fill at progress=p% is the gradient sampled 0..p%.
const GRAD_START = '#87150a'
const GRAD_END = '#eea91c'

function buildFillGradient(progress: number): string {
  // progress is 0..1; gradient stops are scaled so the full ramp appears in
  // the filled portion only. Anything past `progress*100%` is transparent.
  const stop = Math.max(0, Math.min(1, progress)) * 100
  return `linear-gradient(90deg, ${GRAD_START} 0%, ${GRAD_END} ${stop}%, transparent ${stop}%, transparent 100%)`
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

  // Cleanup the idle timer on unmount.
  useEffect(() => () => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
  }, [])

  const progress = duration > 0 ? position / duration : 0
  const height = active ? ACTIVE_HEIGHT : IDLE_HEIGHT

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!containerRef.current || duration <= 0) return
    const rect = containerRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    // duration/position from useAudioSource() are in seconds; seek() takes ms.
    seek(ratio * duration * 1000)
  }

  const containerStyle: CSSProperties = {
    position: 'fixed',
    top: NAV_HEIGHT,
    left: 0,
    right: 0,
    height: `${ACTIVE_HEIGHT}px`, // reserve max height so hover area stays large
    pointerEvents: 'auto',
    zIndex: 600,
    cursor: duration > 0 ? 'pointer' : 'default',
    fontFamily: "'HitmarkerText', monospace",
  }

  const barStyle: CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: `${height}px`,
    transition: 'height 400ms ease',
    background: 'rgba(0, 0, 0, 0.35)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    borderBottom: '1px solid rgba(135, 21, 10, 0.4)',
    overflow: 'hidden',
  }

  const fillStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: buildFillGradient(progress),
    opacity: active ? 0.85 : 0.55,
    transition: 'opacity 400ms ease',
    pointerEvents: 'none',
  }

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      onMouseEnter={wake}
      onMouseMove={wake}
      onClick={handleClick}
      title={duration > 0 ? 'Click to seek' : ''}
    >
      <div style={barStyle}>
        <div style={fillStyle} />
        {active && hasStream && waveform.length > 0 && (
          <WaveformPeaks waveform={waveform} progress={progress} />
        )}
      </div>
    </div>
  )
}

interface PeaksProps {
  waveform: number[]
  progress: number
}

function WaveformPeaks({ waveform, progress }: PeaksProps) {
  // Render the 200-bucket waveform as vertical bars across the full width.
  // Each bar's color comes from the gradient based on its x-position vs the
  // current playback `progress` (so unplayed bars are dim).
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        padding: '0 6px',
        pointerEvents: 'none',
      }}
    >
      {waveform.map((amp, i) => {
        const x = i / Math.max(1, waveform.length - 1)
        const played = x <= progress
        const h = Math.max(2, Math.min(1, amp) * (ACTIVE_HEIGHT - 8))
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${h}px`,
              background: played ? GRAD_END : GRAD_START,
              opacity: played ? 0.95 : 0.55,
            }}
          />
        )
      })}
    </div>
  )
}
