import { useEffect, useState } from 'react'
import {
  play,
  pause,
  nextTrack,
  previousTrack,
  toggleShuffle,
} from '../audio/SpotifyWebPlayer'

const btnStyle: React.CSSProperties = {
  background: 'rgba(1, 1, 3, 0.7)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  border: '1px solid rgba(238, 169, 28, 0.4)',
  color: '#eea91c',
  padding: '12px 20px',
  fontSize: '14px',
  fontFamily: "'HitmarkerText', monospace",
  cursor: 'pointer',
  borderRadius: 0,
  minWidth: '60px',
}

const activeBtnStyle: React.CSSProperties = {
  ...btnStyle,
  background: 'rgba(135, 21, 10, 0.8)',
  color: '#eea91c',
}

interface Props {
  isPlaying: boolean
  shuffleState: boolean
  onGearClick: () => void
}

export default function Controls({ isPlaying, shuffleState, onGearClick }: Props) {
  const [visible, setVisible] = useState(true)

  // Auto-hide controls after 3 seconds of no movement
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>

    const handleMouseMove = () => {
      setVisible(true)
      clearTimeout(timeout)
      timeout = setTimeout(() => setVisible(false), 3000)
    }

    window.addEventListener('mousemove', handleMouseMove)
    handleMouseMove()

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      clearTimeout(timeout)
    }
  }, [])

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
        inset: 0,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
    >
      {/* Gear icon - top right */}
      <button
        onClick={onGearClick}
        style={{
          ...btnStyle,
          position: 'absolute',
          top: '20px',
          right: '20px',
          padding: '10px 14px',
          fontSize: '20px',
          pointerEvents: 'auto',
        }}
        title="Settings"
      >
        &#9881;
      </button>

      {/* NO top-left text - removed per UI overhaul */}

      {/* Playback controls - center bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: '40px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '2px',
          pointerEvents: 'auto',
        }}
      >
        <button onClick={previousTrack} style={btnStyle} title="Previous">
          PREV
        </button>
        <button onClick={handlePlayPause} style={btnStyle} title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? 'PAUSE' : 'PLAY'}
        </button>
        <button onClick={nextTrack} style={btnStyle} title="Next">
          NEXT
        </button>
        <button
          onClick={handleShuffle}
          style={shuffleState ? activeBtnStyle : btnStyle}
          title="Shuffle"
        >
          SHFL
        </button>
      </div>
    </div>
  )
}
