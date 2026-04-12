import { useState, useEffect } from 'react'
import {
  play,
  pause,
  nextTrack,
  previousTrack,
  toggleShuffle,
  getPlaybackState,
  SpotifyPlaybackState,
} from '../audio/SpotifyWebPlayer'
import { getVisualizerEngine } from '../audio/VisualizerEngine'

const btnStyle: React.CSSProperties = {
  background: '#010103',
  border: '1px solid #7a0105',
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
  background: '#7a0105',
  color: '#eea91c',
}

interface Props {
  firstName: string
  onGearClick: () => void
}

export default function Controls({ firstName, onGearClick }: Props) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [shuffleState, setShuffle] = useState(false)
  const [visible, setVisible] = useState(true)
  const [micActive, setMicActive] = useState(false)

  useEffect(() => {
    // Poll playback state every 2 seconds
    const poll = async () => {
      const state: SpotifyPlaybackState | null = await getPlaybackState()
      if (state) {
        setIsPlaying(state.is_playing)
        setShuffle(state.shuffle_state)
        // Keep visualizer in sync with polled state
        getVisualizerEngine().setPlaybackState(state.is_playing)
      }
    }

    poll()
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [])

  // Auto-hide controls after 3 seconds of no movement
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>

    const handleMouseMove = () => {
      setVisible(true)
      clearTimeout(timeout)
      timeout = setTimeout(() => setVisible(false), 3000)
    }

    window.addEventListener('mousemove', handleMouseMove)
    handleMouseMove() // Start timer

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      clearTimeout(timeout)
    }
  }, [])

  const handlePlayPause = async () => {
    // Initialize audio on first user gesture (play button click)
    const engine = getVisualizerEngine()
    if (!engine.isAudioInitialized()) {
      await engine.initializeAudio()
      // Update mic active state after initialization
      setMicActive(engine.isMicActive())
    }

    if (isPlaying) {
      await pause()
      setIsPlaying(false)
      await engine.setPlaybackState(false)
    } else {
      await play()
      setIsPlaying(true)
      await engine.setPlaybackState(true)
    }
  }

  const handleShuffle = async () => {
    const newState = !shuffleState
    await toggleShuffle(newState)
    setShuffle(newState)
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

      {/* User message - top left */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          color: '#eea91c',
          fontSize: '12px',
          fontFamily: "'HitmarkerText', monospace",
          opacity: 0.7,
        }}
      >
        Control music selection from your phone, {firstName}
      </div>

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

      {/* Mic reactive indicator - bottom left (always visible when active) */}
      {micActive && (
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            color: '#eea91c',
            fontSize: '11px',
            fontFamily: "'HitmarkerText', monospace",
            pointerEvents: 'none',
            opacity: 1,
          }}
        >
          🎤 MIC REACTIVE
        </div>
      )}
    </div>
  )
}
