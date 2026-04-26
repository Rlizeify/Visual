import { memo, useEffect, useRef, useState, useCallback, type CSSProperties } from 'react'
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

// ─── localStorage persistence ────────────────────────────────────────────────
const VIZ_STORAGE_KEY = 'mheu_viz_settings'

function loadVizSettings(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(VIZ_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function saveVizSettings(data: Record<string, unknown>): void {
  try {
    const prev = loadVizSettings()
    localStorage.setItem(VIZ_STORAGE_KEY, JSON.stringify({ ...prev, ...data }))
  } catch {
    // Private browsing or storage full — silently ignore
  }
}

// ─── Butterchurn canvas ────────────────────────────────────────────────────
// Wrapped in memo so parent re-renders (track info, controls visibility, etc.)
// never touch the canvas or the engine. Engine init and resize live here;
// the RAF loop is owned by VisualizerEngine (stable class field).
const ButterchurnCanvas = memo(function ButterchurnCanvas({
  showIdle,
  onInitialized,
}: {
  showIdle: boolean
  onInitialized?: (preset: string, settings: VisualizerSettings) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Capture callback at mount time so the empty-deps effect is lint-safe
  const initCbRef = useRef(onInitialized)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const engine = getVisualizerEngine()
    engine.initialize(canvas)
    initCbRef.current?.(engine.getCurrentPreset(), engine.getSettings())

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
  }, []) // intentionally empty — mount once, never re-init on re-render

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        opacity: showIdle ? 0 : 1,
        pointerEvents: showIdle ? 'none' : 'auto',
        transition: 'opacity 1s ease',
      }}
    />
  )
})

// ─── Oscilloscope canvas ───────────────────────────────────────────────────
// Lissajous figures driven by VisualizerEngine beat scheduler data
// (accessed via window.__musicData). Runs its own 60fps RAF loop — always
// mounted so there is zero startup latency when toggling modes.
const ScopeCanvas = memo(function ScopeCanvas({ visible }: { visible: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef({ phaseX: 0, phaseY: 0, prevBeatPulse: 0, rafId: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const ctx = canvas.getContext('2d')!
    const state = stateRef.current

    // Initialise to phosphor background immediately so no flash on first reveal
    ctx.fillStyle = 'rgb(1,1,3)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const draw = () => {
      state.rafId = requestAnimationFrame(draw)

      const w = canvas.width
      const h = canvas.height
      const t = performance.now() / 1000

      // Phosphor persistence decay
      ctx.fillStyle = 'rgba(1,1,3,0.15)'
      ctx.fillRect(0, 0, w, h)

      const md = window.__musicData
      const timbre = md?.timbre ?? []
      const beatPulse = md?.beatPulse ?? 0

      // Kick detection: sharp rise in beatPulse → randomise phase
      if (beatPulse > 0.8 && state.prevBeatPulse < 0.5) {
        state.phaseX += (Math.random() - 0.5) * Math.PI * 0.5
        state.phaseY += (Math.random() - 0.5) * Math.PI * 0.5
      }
      state.prevBeatPulse = beatPulse

      // Map timbre coefficients → Lissajous frequency pair.
      // timbre[2] and timbre[4] vary with instrument character and brightness.
      // Normalise to ~±1 (typical range ±200) then offset to keep freqs positive.
      const normT2 = (timbre[2] ?? 0) / 200
      const normT4 = (timbre[4] ?? 0) / 200
      const freqX = 2 + normT2 * 1.5   // ~0.5 – 3.5
      const freqY = 3 + normT4 * 1.0   // ~2 – 4

      // Parametric Lissajous trace — full cycle so the figure is always complete.
      // Slow t multipliers drift the phase over real time, morphing the shape.
      const cx = w / 2
      const cy = h / 2
      const r = Math.min(w, h) * 0.42

      ctx.beginPath()
      ctx.strokeStyle = '#27e0e1'
      ctx.lineWidth = 2
      const STEPS = 800
      for (let i = 0; i <= STEPS; i++) {
        const u = (i / STEPS) * Math.PI * 2
        const x = cx + r * Math.sin(freqX * u + t * 0.5 + state.phaseX)
        const y = cy + r * Math.sin(freqY * u + t * 0.3 + state.phaseY)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    state.rafId = requestAnimationFrame(draw)

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      // Re-fill background after resize (canvas clears on dimension change)
      ctx.fillStyle = 'rgb(1,1,3)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(state.rafId)
      window.removeEventListener('resize', handleResize)
    }
  }, []) // mount once — RAF loop is fully self-contained

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        opacity: visible ? 1 : 0,
        pointerEvents: 'none',
        transition: 'opacity 0.6s ease',
      }}
    />
  )
})

// ───────────────────────────────────────────────────────────────────────────

export default function VisualizerPage({ onLogout }: { onLogout?: () => void }) {
  const [gearOpen, setGearOpen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [settings, setSettings] = useState<VisualizerSettings>(() => {
    const s = loadVizSettings()
    return {
      bassReactivity: typeof s.bassReactivity === 'number' ? s.bassReactivity : 50,
      midReactivity:  typeof s.midReactivity  === 'number' ? s.midReactivity  : 50,
      highReactivity: typeof s.highReactivity === 'number' ? s.highReactivity : 50,
      animationSpeed: typeof s.animationSpeed === 'number' ? s.animationSpeed : 1,
      blendTime:      typeof s.blendTime      === 'number' ? s.blendTime      : 2.5,
      cycleSpeed:     typeof s.cycleSpeed     === 'number' ? s.cycleSpeed     : 30,
    }
  })
  const [selectedPreset, setSelectedPreset] = useState<string>(() => {
    const s = loadVizSettings()
    return typeof s.selectedPreset === 'string' ? s.selectedPreset : ''
  })
  const [trackName, setTrackName] = useState('')
  const [artistName, setArtistName] = useState('')
  const [albumArt, setAlbumArt] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [shuffleState, setShuffleState] = useState(false)
  const [vizMode, setVizMode] = useState<'viz' | 'scope'>(() => {
    const s = loadVizSettings()
    return s.viz_mode === 'scope' ? 'scope' : 'viz'
  })
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Determine if we should show idle screen
  const showIdle = !isPlaying && !trackName

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

  // Called once after engine init — apply persisted settings/preset to the engine.
  // Component state was already initialised from localStorage; we push it to the engine here.
  const handleEngineInit = useCallback((enginePreset: string, _engineSettings: VisualizerSettings) => {
    const stored = loadVizSettings()
    const eng = getVisualizerEngine()

    // Prefer stored preset; fall back to engine's initial choice
    const storedPreset = typeof stored.selectedPreset === 'string' && stored.selectedPreset
    setSelectedPreset(storedPreset || enginePreset)
    if (storedPreset) eng.loadPreset(storedPreset)

    // Push stored settings values into engine (component state already has them from useState init)
    const patch: Partial<VisualizerSettings> = {}
    const keys: (keyof VisualizerSettings)[] = [
      'bassReactivity', 'midReactivity', 'highReactivity', 'animationSpeed', 'blendTime', 'cycleSpeed',
    ]
    for (const k of keys) {
      if (typeof stored[k] === 'number') patch[k] = stored[k] as number
    }
    if (Object.keys(patch).length > 0) eng.updateSettings(patch)
  }, [])

  // UI sync — poll track metadata at 300 ms; no setState inside the RAF hot path
  useEffect(() => {
    const interval = setInterval(() => {
      const data = getMusicData()
      setTrackName(data.trackName)
      setArtistName(data.artistName)
      setAlbumArt(data.albumArt)
      setIsPlaying(data.isPlaying)
      setShuffleState(data.shuffleState)
    }, 300)
    return () => clearInterval(interval)
  }, [])

  const handleSettingsChange = (newSettings: Partial<VisualizerSettings>) => {
    const updated = { ...settings, ...newSettings }
    setSettings(updated)
    getVisualizerEngine().updateSettings(newSettings)
    saveVizSettings({ ...updated, selectedPreset })
  }

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset)
    getVisualizerEngine().loadPreset(preset)
    saveVizSettings({ ...settings, selectedPreset: preset })
  }

  const handleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
  }

  const handleVizToggle = () => {
    setVizMode(prev => {
      const next = prev === 'viz' ? 'scope' : 'viz'
      saveVizSettings({ viz_mode: next })
      return next
    })
  }

  // Panel styles with border-radius and increased transparency
  const panelStyle: CSSProperties = {
    background: 'rgba(0, 20, 30, 0.30)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(0, 220, 200, 0.4)',
    borderRadius: 8,
  }

  const buttonStyle: CSSProperties = {
    ...panelStyle,
    color: '#00dcc8',
    padding: '10px 14px',
    fontSize: '16px',
    fontFamily: "'HitmarkerText', monospace",
    cursor: 'pointer',
    borderRadius: 4,
    background: 'rgba(0, 20, 30, 0.30)',
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#000000',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Idle screen - shown when not playing and no track */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: showIdle ? 1 : 0,
        pointerEvents: showIdle ? 'auto' : 'none',
        transition: 'opacity 1s ease',
        zIndex: 10,
      }}>
        <div className="idle-orb" />
      </div>

      {/* Butterchurn canvas — memoised, owns its own engine init + resize.
          Hidden in scope mode but still renders to keep window.__musicData live. */}
      <ButterchurnCanvas
        showIdle={showIdle || vizMode === 'scope'}
        onInitialized={handleEngineInit}
      />

      {/* Oscilloscope canvas — always mounted (zero-latency toggle), visible in scope mode */}
      <ScopeCanvas visible={vizMode === 'scope'} />

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
                borderRadius: 4,
              }}
            />
          ) : (
            <div style={{
              width: 80,
              height: 80,
              background: 'rgba(0, 20, 30, 0.5)',
              border: '1px solid rgba(0, 220, 200, 0.2)',
              borderRadius: 4,
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

      {/* SCOPE / VIZ toggle — bottom right, left of fullscreen button */}
      <button
        onClick={handleVizToggle}
        style={{
          ...buttonStyle,
          position: 'fixed',
          bottom: '20px',
          right: '76px',
          fontSize: '11px',
          letterSpacing: '0.08em',
          padding: '10px 12px',
          opacity: controlsVisible ? 1 : 0,
          pointerEvents: controlsVisible ? 'auto' : 'none',
          transition: 'opacity 0.4s ease',
          zIndex: 100,
          border: vizMode === 'scope'
            ? '1px solid rgba(39, 224, 225, 0.8)'
            : '1px solid rgba(0, 220, 200, 0.4)',
          color: vizMode === 'scope' ? '#27e0e1' : '#00dcc8',
        }}
        title={vizMode === 'viz' ? 'Switch to oscilloscope mode' : 'Switch to visualizer mode'}
      >
        {vizMode === 'viz' ? 'SCOPE' : 'VIZ'}
      </button>

      {/* Fullscreen button - bottom right */}
      <button
        onClick={handleFullscreen}
        style={{
          ...buttonStyle,
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
        onLogout={onLogout}
      />
    </div>
  )
}
