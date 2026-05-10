import { play, pause, nextTrack, previousTrack, toggleShuffle } from '../../services/spotify/player'

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--accent-color)',
  padding: '8px 16px',
  fontSize: '13px',
  fontFamily: "'HitmarkerText', monospace",
  cursor: 'pointer',
  borderRadius: 0,
  transition: 'background 0.2s ease',
}

const activeBtnStyle: React.CSSProperties = {
  ...btnStyle,
  background: 'var(--accent-color-bg)',
}

interface Props {
  isPlaying: boolean
  shuffleState: boolean
  visible: boolean
}

export default function Controls({ isPlaying, shuffleState, visible }: Props) {
  const handlePlayPause = async () => {
    if (isPlaying) {
      await pause()
    } else {
      await play()
    }
  }

  const handleShuffle = async () => {
    await toggleShuffle(!shuffleState)
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0, 20, 30, 0.55)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--accent-color-border)',
        padding: '8px 20px',
        display: 'flex',
        gap: '4px',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 0.4s ease',
        zIndex: 500,
      }}
    >
      <button
        onClick={previousTrack}
        style={btnStyle}
        title="Previous"
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-color-bg)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        PREV
      </button>
      <button
        onClick={handlePlayPause}
        style={btnStyle}
        title={isPlaying ? 'Pause' : 'Play'}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-color-bg)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        {isPlaying ? 'PAUSE' : 'PLAY'}
      </button>
      <button
        onClick={nextTrack}
        style={btnStyle}
        title="Next"
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-color-bg)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        NEXT
      </button>
      <button
        onClick={handleShuffle}
        style={shuffleState ? activeBtnStyle : btnStyle}
        title="Shuffle"
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-color-bg)')}
        onMouseLeave={e => (e.currentTarget.style.background = shuffleState ? 'var(--accent-color-bg)' : 'transparent')}
      >
        SHFL
      </button>
    </div>
  )
}
