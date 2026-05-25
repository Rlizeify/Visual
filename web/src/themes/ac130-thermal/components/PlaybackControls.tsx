import { useState, type CSSProperties } from 'react'
import { play, pause, nextTrack, previousTrack, toggleShuffle } from '../../../services/spotify/player'

interface Props {
  isPlaying: boolean
  shuffleState: boolean
  visible: boolean
}

/**
 * PlaybackControls for AC-130 Thermal.
 *
 * Bottom-center mini "weapons-station" plate. Black panel, thin
 * green wire border, four bracketed glyph buttons. Active shuffle
 * lights amber (advisory). No fills, no rounded corners.
 *
 * Player actions identical to Frutiger Aero — only chrome differs.
 */
export default function AC130ThermalPlaybackControls({ isPlaying, shuffleState, visible }: Props) {
  const [hover, setHover] = useState<string | null>(null)

  const handlePlayPause = async () => {
    if (isPlaying) await pause()
    else await play()
  }
  const handleShuffle = async () => {
    await toggleShuffle(!shuffleState)
  }

  const shelfStyle: CSSProperties = {
    position: 'fixed',
    bottom: '36px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '6px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'var(--ac-panel-deep)',
    backgroundImage: 'var(--ac-scanline-bg)',
    border: '1px solid var(--ac-frame-wire)',
    boxShadow: '0 0 0 1px rgba(255,255,255,0.10), 0 8px 24px -12px rgba(255,255,255,0.20)',
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? 'auto' : 'none',
    transition: 'opacity 0.3s linear',
    zIndex: 500,
    fontFamily: 'var(--ac-font-mono)',
  }

  // Status label that sits above the controls.
  const labelStyle: CSSProperties = {
    position: 'absolute',
    top: '-14px',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: '8px',
    letterSpacing: '0.30em',
    color: 'var(--ac-phosphor-dim)',
    textTransform: 'uppercase',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  }

  const buttonStyle = (key: string, active: boolean, danger = false): CSSProperties => {
    const isHover = hover === key
    const color = active
      ? 'var(--ac-amber)'
      : danger
        ? 'var(--ac-ir-red)'
        : 'var(--ac-phosphor)'
    const border = active
      ? 'var(--ac-amber)'
      : isHover
        ? 'var(--ac-frame-bracket)'
        : 'var(--ac-frame-wire)'
    const glow = active
      ? 'var(--ac-glow-amber)'
      : isHover
        ? 'var(--ac-glow-phosphor-soft)'
        : 'none'
    return {
      width: '36px',
      height: '32px',
      background: active ? 'var(--ac-amber-wash)' : 'transparent',
      border: `1px solid ${border}`,
      color,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
      fontFamily: 'var(--ac-font-mono)',
      fontSize: '13px',
      fontWeight: 700,
      letterSpacing: '0.05em',
      borderRadius: 0,
      transition: 'all 150ms linear',
      boxShadow: glow,
    }
  }

  return (
    <div style={shelfStyle}>
      <span style={labelStyle}>
        [ AUDIO STATION ]
      </span>

      <button
        onClick={previousTrack}
        style={buttonStyle('prev', false)}
        onMouseEnter={() => setHover('prev')}
        onMouseLeave={() => setHover(null)}
        title="Previous"
        aria-label="Previous track"
      >
        ⏮
      </button>

      <button
        onClick={handlePlayPause}
        style={buttonStyle('play', false)}
        onMouseEnter={() => setHover('play')}
        onMouseLeave={() => setHover(null)}
        title={isPlaying ? 'Pause' : 'Play'}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      <button
        onClick={nextTrack}
        style={buttonStyle('next', false)}
        onMouseEnter={() => setHover('next')}
        onMouseLeave={() => setHover(null)}
        title="Next"
        aria-label="Next track"
      >
        ⏭
      </button>

      <button
        onClick={handleShuffle}
        style={buttonStyle('shfl', shuffleState)}
        onMouseEnter={() => setHover('shfl')}
        onMouseLeave={() => setHover(null)}
        title="Shuffle"
        aria-label="Toggle shuffle"
      >
        ⤨
      </button>
    </div>
  )
}
