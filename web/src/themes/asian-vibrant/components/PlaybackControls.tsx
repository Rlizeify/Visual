import { useState, type CSSProperties } from 'react'
import { play, pause, nextTrack, previousTrack, toggleShuffle } from '../../../services/spotify/player'
import { PlayBrush, PauseBrush, NextBrush, PrevBrush, ShuffleBrush } from './BrushIcons'

interface Props {
  isPlaying: boolean
  shuffleState: boolean
  visible: boolean
}

/**
 * PlaybackControls for Asian Vibrant.
 *
 * Bottom-center "instrument shelf": a lacquered crimson plank with
 * gold-leaf trim, holding four brushstroke buttons. Buttons rest
 * directly on the wood; hover paints a soft ink wash behind them.
 * The active shuffle state lights a vermillion gold-edged seal.
 */
export default function AsianVibrantPlaybackControls({ isPlaying, shuffleState, visible }: Props) {
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
    bottom: '22px',
    left: '50%',
    transform: 'translateX(-50%)',
    background:
      'linear-gradient(180deg, var(--av-crimson-deep) 0%, var(--av-crimson) 55%, var(--av-night) 100%)',
    border: '1px solid var(--av-gold-deep)',
    borderRadius: 'var(--radius)',
    padding: '8px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? 'auto' : 'none',
    transition: 'opacity 0.4s ease',
    zIndex: 500,
    boxShadow:
      '0 6px 18px -8px rgba(26,20,16,0.65), inset 0 1px 0 rgba(244,236,216,0.18), inset 0 -1px 0 rgba(0,0,0,0.35)',
  }

  // Single thin gold leaf line along the top of the shelf
  const goldLineStyle: CSSProperties = {
    position: 'absolute',
    top: '3px',
    left: '14px',
    right: '14px',
    height: '1px',
    background:
      'linear-gradient(90deg, transparent 0%, var(--av-gold) 20%, var(--av-gold) 80%, transparent 100%)',
    pointerEvents: 'none',
    opacity: 0.55,
  }

  const buttonStyle = (key: string, active: boolean): CSSProperties => {
    const isHover = hover === key
    return {
      width: '40px',
      height: '40px',
      background: active
        ? 'var(--av-vermillion)'
        : isHover
          ? 'rgba(244,236,216,0.10)'
          : 'transparent',
      border: active ? '1px solid var(--av-gold)' : '1px solid transparent',
      borderRadius: '4px',
      color: active ? 'var(--av-paper)' : 'var(--av-paper-soft)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
      transition: 'background 180ms ease, color 180ms ease, border-color 180ms ease',
      boxShadow: active ? '0 1px 0 rgba(26,20,16,0.40), inset 0 0 0 1px rgba(244,236,216,0.10)' : 'none',
    }
  }

  return (
    <div style={shelfStyle}>
      <div style={goldLineStyle} />

      <button
        onClick={previousTrack}
        style={buttonStyle('prev', false)}
        onMouseEnter={() => setHover('prev')}
        onMouseLeave={() => setHover(null)}
        title="Previous"
        aria-label="Previous track"
      >
        <PrevBrush size={22} />
      </button>

      <button
        onClick={handlePlayPause}
        style={buttonStyle('play', false)}
        onMouseEnter={() => setHover('play')}
        onMouseLeave={() => setHover(null)}
        title={isPlaying ? 'Pause' : 'Play'}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <PauseBrush size={22} /> : <PlayBrush size={22} />}
      </button>

      <button
        onClick={nextTrack}
        style={buttonStyle('next', false)}
        onMouseEnter={() => setHover('next')}
        onMouseLeave={() => setHover(null)}
        title="Next"
        aria-label="Next track"
      >
        <NextBrush size={22} />
      </button>

      <button
        onClick={handleShuffle}
        style={buttonStyle('shfl', shuffleState)}
        onMouseEnter={() => setHover('shfl')}
        onMouseLeave={() => setHover(null)}
        title="Shuffle"
        aria-label="Toggle shuffle"
      >
        <ShuffleBrush size={22} />
      </button>
    </div>
  )
}
