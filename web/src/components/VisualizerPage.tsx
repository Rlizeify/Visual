import { useEffect, useRef, useState } from 'react'
import {
  fetchUserProfile,
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
  const [firstName, setFirstName] = useState('')
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

  // Fetch user profile
  useEffect(() => {
    fetchUserProfile().then(profile => {
      if (profile?.display_name) {
        setFirstName(profile.display_name.split(' ')[0])
      }
    })
  }, [])

  // Start Spotify API polling
  useEffect(() => {
    startPolling()
    return () => stopPolling()
  }, [])

  // Initialize Butterchurn and run animation loop
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

    // Animation loop: feed music data into visualizer each frame
    let rafId: number
    const loop = () => {
      const data = getMusicData()
      engine.updateMusicData(data)

      // Sync UI state from polled data
      setTrackName(data.trackName)
      setArtistName(data.artistName)
      setAlbumArt(data.albumArt)
      setIsPlaying(data.isPlaying)
      setShuffleState(data.shuffleState)

      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)

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
        firstName={firstName}
        isPlaying={isPlaying}
        shuffleState={shuffleState}
        onGearClick={() => setGearOpen(true)}
      />

      {/* Track info + album art — bottom left */}
      {(trackName || albumArt) && (
        <div style={{
          position: 'absolute',
          bottom: '24px',
          left: '20px',
          display: 'flex',
          alignItems: 'flex-end',
          gap: '12px',
          pointerEvents: 'none',
        }}>
          {albumArt && (
            <img
              src={albumArt}
              alt="Album art"
              style={{ width: 80, height: 80, objectFit: 'cover' }}
            />
          )}
          <div>
            {trackName && (
              <div style={{
                color: '#eea91c',
                fontSize: '12px',
                fontFamily: "'HitmarkerText', monospace",
                lineHeight: 1.4,
              }}>
                {trackName}
              </div>
            )}
            {artistName && (
              <div style={{
                color: '#eea91c',
                fontSize: '11px',
                fontFamily: "'HitmarkerText', monospace",
                opacity: 0.7,
                lineHeight: 1.4,
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
