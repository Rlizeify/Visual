import { memo, useEffect, useRef, useState, useCallback, type CSSProperties } from 'react'
import { startPolling, stopPolling, getMusicData } from '../services/spotify/polling'
import { postServerSettings } from '../services/spotify/session'
import { getVisualizerEngine, destroyVisualizerEngine, VisualizerSettings } from '../audio/VisualizerEngine'
import Controls from './Controls'
import GearMenu from './GearMenu'
import ScopeCanvas from '../features/oscilloscope/ScopeCanvas'
import OsciPanel from '../features/oscilloscope/OsciPanel'
import { loadOsciSettings, saveOsciSettings } from '../features/oscilloscope/storage'
import type { OsciSettings } from '../features/oscilloscope/types'

// ─── VIZ settings localStorage ───────────────────────────────────────────────
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

// ─── ButterchurnCanvas ────────────────────────────────────────────────────────
// Wrapped in memo so parent re-renders never touch the canvas or engine.
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

// ─── VisualizerPage ───────────────────────────────────────────────────────────

export default function VisualizerPage({ onLogout, displayName }: { onLogout?: () => void; displayName?: string }) {
  const [gearOpen, setGearOpen]           = useState(false)
  const [osciPanelOpen, setOsciPanelOpen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [settings, setSettings] = useState<VisualizerSettings>(() => {
    const s = loadVizSettings()
    return {
      bassReactivity: typeof s.bassReactivity === 'number' ? s.bassReactivity : 50,
      midReactivity:  typeof s.midReactivity  === 'number' ? s.midReactivity  : 50,
      highReactivity: typeof s.highReactivity === 'number' ? s.highReactivity : 50,
      animationSpeed: typeof s.animationSpeed === 'number' ? s.animationSpeed : 1,
      blendTime:      typeof s.blendTime      === 'number' ? s.blendTime      : 2.5,
      cycleSpeed:     typeof s.cycleSpeed     === 'number' ? s.cycleSpeed     : 15,
    }
  })
  const [selectedPreset, setSelectedPreset] = useState<string>(() => {
    const s = loadVizSettings()
    return typeof s.selectedPreset === 'string' ? s.selectedPreset : ''
  })
  const [trackName,    setTrackName]    = useState('')
  const [artistName,   setArtistName]   = useState('')
  const [albumArt,     setAlbumArt]     = useState('')
  const [isPlaying,    setIsPlaying]    = useState(false)
  const [shuffleState, setShuffleState] = useState(false)
  const [vizMode, setVizMode] = useState<'viz' | 'scope'>(() => {
    const s = loadVizSettings()
    return s.viz_mode === 'scope' ? 'scope' : 'viz'
  })
  const [osciSettings, setOsciSettings] = useState<OsciSettings>(loadOsciSettings)
  const [liveAudioActive, setLiveAudioActive] = useState<boolean>(() => getVisualizerEngine().isLiveAudioEnabled())

  // Always in sync — RAF loop reads this without triggering re-renders
  const osciSettingsRef = useRef<OsciSettings>(osciSettings)
  osciSettingsRef.current = osciSettings

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showIdle   = !isPlaying && !trackName && !liveAudioActive

  // Mouse idle system
  const handleMouseMove = useCallback(() => {
    setControlsVisible(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setControlsVisible(false), 3000)
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    handleMouseMove()
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [handleMouseMove])

  // Spotify polling
  useEffect(() => {
    startPolling()
    return () => stopPolling()
  }, [])

  // Fetch server settings once on mount; merge over localStorage defaults silently
  useEffect(() => {
    const jwt = localStorage.getItem('mheu_session')
    if (!jwt) return
    fetch('/api/settings', {
      headers: { Authorization: `Bearer ${jwt}` },
    })
      .then(res => (res.ok ? res.json() : null))
      .then((data: Record<string, unknown> | null) => {
        if (!data || typeof data !== 'object' || Array.isArray(data)) return
        const patch: Partial<VisualizerSettings> = {}
        const numKeys: (keyof VisualizerSettings)[] = [
          'bassReactivity', 'midReactivity', 'highReactivity', 'animationSpeed', 'blendTime', 'cycleSpeed',
        ]
        for (const k of numKeys) {
          if (typeof data[k] === 'number') patch[k] = data[k] as number
        }
        if (Object.keys(patch).length > 0) {
          setSettings(prev => ({ ...prev, ...patch }))
          getVisualizerEngine().updateSettings(patch)
        }
        if (typeof data.selectedPreset === 'string' && data.selectedPreset) {
          setSelectedPreset(data.selectedPreset)
          getVisualizerEngine().loadPreset(data.selectedPreset)
        }
        if (data.viz_mode === 'scope' || data.viz_mode === 'viz') {
          setVizMode(data.viz_mode)
        }
        try {
          const prev = JSON.parse(localStorage.getItem('mheu_viz_settings') || '{}')
          localStorage.setItem('mheu_viz_settings', JSON.stringify({ ...prev, ...data }))
        } catch { /* storage full */ }
      })
      .catch(() => { /* network error — fall back to localStorage silently */ })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply persisted settings/preset to engine after init
  const handleEngineInit = useCallback((enginePreset: string, _engineSettings: VisualizerSettings) => {
    const stored = loadVizSettings()
    const eng    = getVisualizerEngine()
    const storedPreset = typeof stored.selectedPreset === 'string' && stored.selectedPreset
    setSelectedPreset(storedPreset || enginePreset)
    if (storedPreset) eng.loadPreset(storedPreset)
    const patch: Partial<VisualizerSettings> = {}
    const keys: (keyof VisualizerSettings)[] = [
      'bassReactivity', 'midReactivity', 'highReactivity', 'animationSpeed', 'blendTime', 'cycleSpeed',
    ]
    for (const k of keys) {
      if (typeof stored[k] === 'number') patch[k] = stored[k] as number
    }
    if (Object.keys(patch).length > 0) eng.updateSettings(patch)
  }, [])

  // Poll track metadata at 300 ms
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
    const blob = { ...updated, selectedPreset, viz_mode: vizMode }
    saveVizSettings(blob)
    postServerSettings(blob as unknown as Record<string, unknown>)
  }

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset)
    getVisualizerEngine().loadPreset(preset)
    const blob = { ...settings, selectedPreset: preset, viz_mode: vizMode }
    saveVizSettings(blob)
    postServerSettings(blob as unknown as Record<string, unknown>)
  }

  const handleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen()
  }

  const handleVizToggle = () => {
    setVizMode(prev => {
      const next = prev === 'viz' ? 'scope' : 'viz'
      const blob = { ...settings, selectedPreset, viz_mode: next }
      saveVizSettings(blob)
      postServerSettings(blob as unknown as Record<string, unknown>)
      if (next !== 'scope') setOsciPanelOpen(false)
      return next
    })
  }

  const handleOsciChange = (s: OsciSettings) => {
    setOsciSettings(s)
    saveOsciSettings(s)
  }

  // Shared panel + button styles
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
      {/* Idle screen */}
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

      {/* Butterchurn — hidden in scope mode but kept alive to feed window.__musicData */}
      <ButterchurnCanvas
        showIdle={showIdle || vizMode === 'scope'}
        onInitialized={handleEngineInit}
      />

      {/* Oscilloscope — always mounted, visible only in scope mode */}
      <ScopeCanvas visible={vizMode === 'scope'} settingsRef={osciSettingsRef} />

      {/* Track info — bottom left, always visible */}
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
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {albumArt ? (
            <img
              src={albumArt}
              alt="Album art"
              style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4 }}
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

      {/* Playback controls — bottom center */}
      <Controls isPlaying={isPlaying} shuffleState={shuffleState} visible={controlsVisible} />

      {/* OSCI settings panel — scope mode only */}
      {vizMode === 'scope' && osciPanelOpen && (
        <OsciPanel settings={osciSettings} onChange={handleOsciChange} />
      )}

      {/* OSCI settings icon — left of SCOPE/VIZ toggle, visible in scope mode only */}
      {vizMode === 'scope' && (
        <button
          onClick={() => setOsciPanelOpen(p => !p)}
          style={{
            ...buttonStyle,
            position: 'fixed',
            bottom: '20px',
            right: '144px',
            fontSize: '14px',
            padding: '10px 11px',
            opacity: controlsVisible ? 1 : 0,
            pointerEvents: controlsVisible ? 'auto' : 'none',
            transition: 'opacity 0.4s ease',
            zIndex: 100,
            border: osciPanelOpen
              ? '1px solid rgba(39,224,225,0.9)'
              : '1px solid rgba(0,220,200,0.4)',
            color: osciPanelOpen ? '#27e0e1' : '#00dcc8',
          }}
          title="OSCI render settings"
        >
          ⚙
        </button>
      )}

      {/* SCOPE / VIZ toggle — bottom right */}
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

      {/* Fullscreen button — bottom right */}
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

      {/* Display name badge — top left */}
      {displayName && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '20px',
          color: '#00dcc8',
          fontFamily: 'monospace',
          fontSize: '11px',
          letterSpacing: '0.05em',
          opacity: 0.6,
          pointerEvents: 'none',
          zIndex: 100,
        }}>
          {displayName}
        </div>
      )}

      {/* Gear button — top right */}
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
        onLiveAudioChange={setLiveAudioActive}
        onLogout={onLogout}
      />
    </div>
  )
}
