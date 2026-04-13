import { useEffect, useRef, useState } from 'react'
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

  // Start Spotify API polling (includes render loop for frequency data)
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

    // UI sync loop (separate from visualizer render)
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

      {/* Controls overlay */}
      <Controls
        isPlaying={isPlaying}
        shuffleState={shuffleState}
        onGearClick={() => setGearOpen(true)}
      />

      {/* Bottom-left track info block */}
      {(trackName || albumArt) && (
        <div style={{
          position: 'absolute',
          bottom: '24px',
          left: '20px',
          display: 'flex',
          alignItems: 'flex-end',
          gap: '12px',
          pointerEvents: 'none',
          background: 'rgba(1, 1, 3, 0.7)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(238, 169, 28, 0.4)',
          padding: '8px',
        }}>
          {/* Album art: 80x80px, hard edges */}
          {albumArt && (
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
          )}
          <div style={{ maxWidth: '200px' }}>
            {/* Song name: #eea91c, 14px, max 2 lines */}
            {trackName && (
              <div style={{
                color: '#eea91c',
                fontSize: '14px',
                fontFamily: "'HitmarkerText', monospace",
                lineHeight: 1.3,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}>
                {trackName}
              </div>
            )}
            {/* Artist name: #87150a, 12px */}
            {artistName && (
              <div style={{
                color: '#87150a',
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
      )}

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
