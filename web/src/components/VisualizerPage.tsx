import { useEffect, useRef, useState } from 'react'
import {
  fetchUserProfile,
  initializePlayer,
  transferPlayback,
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
  const [isReady, setIsReady] = useState(false)
  const [audioConnected, setAudioConnected] = useState(false)

  // Fetch user profile
  useEffect(() => {
    fetchUserProfile().then(profile => {
      if (profile?.display_name) {
        const name = profile.display_name.split(' ')[0]
        setFirstName(name)
      }
    })
  }, [])

  // Initialize Spotify Player
  useEffect(() => {
    initializePlayer(
      (deviceId) => {
        // Transfer playback to this device
        transferPlayback(deviceId)
        setIsReady(true)
      },
      (_state) => {
        // State change handler - already polling in Controls
      }
    )
  }, [])

  // Initialize Butterchurn visualizer
  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const engine = getVisualizerEngine()

    // Set initial size
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    engine.initialize(canvas)
    setSelectedPreset(engine.getCurrentPreset())
    setSettings(engine.getSettings())

    // Handle resize
    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      engine.resize(window.innerWidth, window.innerHeight)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
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

  const handleConnectAudio = async () => {
    const engine = getVisualizerEngine()
    const success = await engine.captureTabAudio()
    if (success) {
      setAudioConnected(true)
    }
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
        onGearClick={() => setGearOpen(true)}
      />

      {/* Gear menu */}
      <GearMenu
        isOpen={gearOpen}
        onClose={() => setGearOpen(false)}
        settings={settings}
        selectedPreset={selectedPreset}
        onSettingsChange={handleSettingsChange}
        onPresetChange={handlePresetChange}
      />

      {/* Loading indicator */}
      {!isReady && (
        <div style={{
          position: 'absolute',
          bottom: '100px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#eea91c',
          fontSize: '12px',
          fontFamily: "'HitmarkerText', monospace",
          opacity: 0.7,
        }}>
          Connecting to Spotify...
        </div>
      )}

      {/* Connect Audio button - shown until audio is connected */}
      {isReady && !audioConnected && (
        <button
          onClick={handleConnectAudio}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: '#7a0105',
            border: '2px solid #eea91c',
            color: '#eea91c',
            padding: '20px 40px',
            fontSize: '18px',
            fontFamily: "'HitmarkerText', monospace",
            cursor: 'pointer',
            borderRadius: 0,
          }}
        >
          CONNECT AUDIO
        </button>
      )}
    </div>
  )
}
