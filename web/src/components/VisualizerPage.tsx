import { useEffect, useRef, useState, useCallback } from 'react'
import {
  startPolling,
  stopPolling,
  getMusicData,
} from '../audio/SpotifyWebPlayer'
import {
  getVisualizerEngine,
  destroyVisualizerEngine,
  VisualizerSettings,
} from '../audio/VisualizerEngine'
import Controls from './Controls'
import GearMenu from './GearMenu'

export default function VisualizerPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gearOpen, setGearOpen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [settings, setSettings] = useState<VisualizerSettings>({
    bassReactivity: 50,
    midReactivity: 50,
    highReactivity: 50,
    animationSpeed: 1,
    blendTime: 2.5,
    cycleSpeed: 30,
  })
  const [selectedPreset, setSelectedPreset] = useState('')
  const [trackName, setTrackName] = useState('')
  const [artistName, setArtistName] = useState('')
  const [albumArt, setAlbumArt] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [shuffleState, setShuffleState] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Mouse idle system - track movement globally
  const handleMouseMove = useCallback(() => {
    setControlsVisible(true)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setControlsVisible(false)
    }, 3000)
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    handleMouseMove() // Initial trigger
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [handleMouseMove])

  // Start Spotify API polling
  useEffect(() => {
    startPolling()
    return () => stopPolling()
  }, [])

  // Initialize Butterchurn
  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const engine = getVisualizerEngine()

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    engine.initialize(canvas)
    setSelectedPreset(engine.getCurrentPreset())
    setSettings(engine.getSettings())

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      engine.resize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', handleResize)

    // UI sync loop
    let rafId: number
    const syncUI = () => {
      const data = getMusicData()
      setTrackName(data.trackName)
      setArtistName(data.artistName)
      setAlbumArt(data.albumArt)
      setIsPlaying(data.isPlaying)
      setShuffleState(data.shuffleState)
      rafId = requestAnimationFrame(syncUI)
    }
    rafId = requestAnimationFrame(syncUI)

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(rafId)
      destroyVisualizerEngine()
    }
  }, [])

  const handleSettingsChange = (newSettings: Partial<VisualizerSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }))
    getVisualizerEngine().updateSettings(newSettings)
  }

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset)
    getVisualizerEngine().loadPreset(preset)
  }

  const handleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
  }

  // Panel styles
  const panelStyle: React.CSSProperties = {
    background: 'rgba(0, 20, 30, 0.55)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(0, 220, 200, 0.4)',
  }

  const buttonStyle: React.CSSProperties = {
    ...panelStyle,
    color: '#00dcc8',
    padding: '10px 14px',
    fontSize: '16px',
    fontFamily: "'HitmarkerText', monospace",
    cursor: 'pointer',
    borderRadius: 0,
    background: 'transparent',
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#010103',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Butterchurn canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
      />

      {/* Bottom-left info block - ALWAYS VISIBLE */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        ...panelStyle,
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents: 'none',
        zIndex: 100,
      }}>
        {/* Row 1: Album art + track info */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {albumArt ? (
            <img
              src={albumArt}
              alt="Album art"
              style={{
                width: 80,
                height: 80,
                objectFit: 'cover',
                borderRadius: 0,
              }}
            />
          ) : (
            <div style={{
              width: 80,
              height: 80,
              background: 'rgba(0, 20, 30, 0.8)',
              border: '1px solid rgba(0, 220, 200, 0.2)',
            }} />
          )}
          <div style={{ maxWidth: '200px' }}>
            <div style={{
              color: '#00dcc8',
              fontSize: '14px',
              fontFamily: "'HitmarkerText', monospace",
              lineHeight: 1.3,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}>
              {trackName || 'No track playing'}
            </div>
            {artistName && (
              <div style={{
                color: 'rgba(180, 240, 235, 0.7)',
                fontSize: '12px',
                fontFamily: "'HitmarkerText', monospace",
                lineHeight: 1.3,
                marginTop: '4px',
              }}>
                {artistName}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls - bottom center */}
      <Controls
        isPlaying={isPlaying}
        shuffleState={shuffleState}
        visible={controlsVisible}
      />

      {/* Fullscreen button - bottom right */}
      <button
        onClick={handleFullscreen}
        style={{
          ...buttonStyle,
          ...panelStyle,
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          opacity: controlsVisible ? 1 : 0,
          pointerEvents: controlsVisible ? 'auto' : 'none',
          transition: 'opacity 0.4s ease',
          zIndex: 100,
        }}
        title="Toggle fullscreen"
      >
        &#x26F6;
      </button>

      {/* Gear button - top right */}
      <button
        onClick={() => setGearOpen(true)}
        style={{
          ...buttonStyle,
          ...panelStyle,
          position: 'fixed',
          top: '20px',
          right: '20px',
          fontSize: '20px',
          opacity: controlsVisible ? 1 : 0,
          pointerEvents: controlsVisible ? 'auto' : 'none',
          transition: 'opacity 0.4s ease',
          zIndex: 100,
        }}
        title="Settings"
      >
        &#9881;
      </button>

      {/* Gear menu */}
      <GearMenu
        isOpen={gearOpen}
        onClose={() => setGearOpen(false)}
        settings={settings}
        selectedPreset={selectedPreset}
        onSettingsChange={handleSettingsChange}
        onPresetChange={handlePresetChange}
      />
    </div>
  )
}
