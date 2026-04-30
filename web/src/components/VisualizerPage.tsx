import { memo, useEffect, useRef, useState, useCallback, type CSSProperties, type MutableRefObject } from 'react'
import {
  startPolling,
  stopPolling,
  getMusicData,
  postServerSettings,
} from '../audio/SpotifyWebPlayer'
import {
  getVisualizerEngine,
  destroyVisualizerEngine,
  VisualizerSettings,
} from '../audio/VisualizerEngine'
import Controls from './Controls'
import GearMenu from './GearMenu'

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

// ─── OSCI settings ────────────────────────────────────────────────────────────
interface OsciSettings {
  freqX: number       // 0.5–10
  freqY: number       // 0.5–10
  phase: number       // degrees 0–360 (static base offset on X channel)
  thickness: number   // px 1–6 (base; multiplied by loudness 0.5x–2x)
  persistence: number // 0.01–0.3 (phosphor decay alpha per frame)
  spin: number        // 0–2 (phase drift speed)
  beatKick: number    // degrees 0–180 (phaseX shift on kick)
  color: string       // hex
}

const OSCI_DEFAULTS: OsciSettings = {
  freqX: 3,
  freqY: 2,
  phase: 0,
  thickness: 2,
  persistence: 0.15,
  spin: 0.3,
  beatKick: 45,
  color: '#27e0e1',
}

const OSCI_STORAGE_KEY = 'mheu_osci_settings'
const OSCI_COLORS = ['#27e0e1', '#eea91c', '#7a0105', '#ffffff', '#ff2d78']

function loadOsciSettings(): OsciSettings {
  try {
    const raw = localStorage.getItem(OSCI_STORAGE_KEY)
    if (!raw) return { ...OSCI_DEFAULTS }
    const p = JSON.parse(raw)
    if (!p || typeof p !== 'object') return { ...OSCI_DEFAULTS }
    return {
      freqX:       typeof p.freqX       === 'number' ? p.freqX       : OSCI_DEFAULTS.freqX,
      freqY:       typeof p.freqY       === 'number' ? p.freqY       : OSCI_DEFAULTS.freqY,
      phase:       typeof p.phase       === 'number' ? p.phase       : OSCI_DEFAULTS.phase,
      thickness:   typeof p.thickness   === 'number' ? p.thickness   : OSCI_DEFAULTS.thickness,
      persistence: typeof p.persistence === 'number' ? p.persistence : OSCI_DEFAULTS.persistence,
      spin:        typeof p.spin        === 'number' ? p.spin        : OSCI_DEFAULTS.spin,
      beatKick:    typeof p.beatKick    === 'number' ? p.beatKick    : OSCI_DEFAULTS.beatKick,
      color:       typeof p.color       === 'string' ? p.color       : OSCI_DEFAULTS.color,
    }
  } catch {
    return { ...OSCI_DEFAULTS }
  }
}

function saveOsciSettings(s: OsciSettings): void {
  try {
    localStorage.setItem(OSCI_STORAGE_KEY, JSON.stringify(s))
  } catch {
    // silently ignore
  }
}

// ─── OsciSlider ───────────────────────────────────────────────────────────────
function OsciSlider({ label, value, min, max, step, unit, onChange }: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
}) {
  const labelStyle: CSSProperties = {
    color: '#27e0e1',
    fontSize: 10,
    fontFamily: 'monospace',
    letterSpacing: '0.06em',
    minWidth: 84,
    userSelect: 'none',
  }
  const numInputStyle: CSSProperties = {
    width: 46,
    background: 'rgba(0,10,16,0.9)',
    border: '1px solid rgba(39,224,225,0.45)',
    color: '#27e0e1',
    fontFamily: 'monospace',
    fontSize: 10,
    padding: '2px 4px',
    textAlign: 'right',
    borderRadius: 0,
    outline: 'none',
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
      <span style={labelStyle}>{label}</span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: '#27e0e1', cursor: 'pointer', height: 14 }}
      />
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={e => {
          const v = parseFloat(e.target.value)
          if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)))
        }}
        style={numInputStyle}
      />
      <span style={{ color: 'rgba(39,224,225,0.5)', fontSize: 9, fontFamily: 'monospace', minWidth: 14 }}>
        {unit}
      </span>
    </div>
  )
}

// ─── OsciPanel ────────────────────────────────────────────────────────────────
function OsciPanel({ settings, onChange }: {
  settings: OsciSettings
  onChange: (s: OsciSettings) => void
}) {
  const set = <K extends keyof OsciSettings>(k: K, v: OsciSettings[K]) =>
    onChange({ ...settings, [k]: v })

  return (
    <div style={{
      position: 'fixed',
      right: 20,
      bottom: 70,
      width: 310,
      zIndex: 200,
      background: 'rgba(0,8,14,0.94)',
      border: '1px solid #27e0e1',
      borderRadius: 0,
      padding: '12px 14px',
      fontFamily: 'monospace',
      boxShadow: '0 0 20px rgba(39,224,225,0.12)',
      pointerEvents: 'auto',
    }}>
      <div style={{
        color: '#27e0e1',
        fontSize: 11,
        letterSpacing: '0.18em',
        fontFamily: 'monospace',
        marginBottom: 12,
        borderBottom: '1px solid rgba(39,224,225,0.25)',
        paddingBottom: 7,
        userSelect: 'none',
      }}>
        OSCI RENDER
      </div>

      <OsciSlider label="FREQ X"      value={settings.freqX}       min={0.5}  max={10}  step={0.1}  unit=""   onChange={v => set('freqX', v)} />
      <OsciSlider label="FREQ Y"      value={settings.freqY}       min={0.5}  max={10}  step={0.1}  unit=""   onChange={v => set('freqY', v)} />
      <OsciSlider label="PHASE"       value={settings.phase}       min={0}    max={360} step={1}    unit="°"  onChange={v => set('phase', v)} />
      <OsciSlider label="THICKNESS"   value={settings.thickness}   min={1}    max={6}   step={0.5}  unit="px" onChange={v => set('thickness', v)} />
      <OsciSlider label="PERSISTENCE" value={settings.persistence} min={0.01} max={0.3} step={0.01} unit=""   onChange={v => set('persistence', v)} />
      <OsciSlider label="SPIN"        value={settings.spin}        min={0}    max={2}   step={0.1}  unit=""   onChange={v => set('spin', v)} />
      <OsciSlider label="BEAT KICK"   value={settings.beatKick}    min={0}    max={180} step={5}    unit="°"  onChange={v => set('beatKick', v)} />

      <div style={{ marginTop: 10, borderTop: '1px solid rgba(39,224,225,0.2)', paddingTop: 10 }}>
        <span style={{
          color: 'rgba(39,224,225,0.55)',
          fontSize: 10,
          fontFamily: 'monospace',
          letterSpacing: '0.1em',
          display: 'block',
          marginBottom: 8,
        }}>
          COLOR
        </span>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          {OSCI_COLORS.map(c => (
            <div
              key={c}
              onClick={() => set('color', c)}
              style={{
                width: 24,
                height: 24,
                background: c,
                cursor: 'pointer',
                borderRadius: 0,
                border: settings.color === c ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.18)',
                boxShadow: settings.color === c ? `0 0 8px ${c}` : 'none',
                transition: 'border 0.1s, box-shadow 0.1s',
              }}
              title={c}
            />
          ))}
        </div>
      </div>
    </div>
  )
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

// ─── ScopeCanvas ──────────────────────────────────────────────────────────────
// Always mounted for zero-latency toggle. RAF loop reads settingsRef.current each
// frame — no re-render needed when settings change.
const ScopeCanvas = memo(function ScopeCanvas({
  visible,
  settingsRef,
}: {
  visible: boolean
  settingsRef: MutableRefObject<OsciSettings>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef  = useRef({ phaseX: 0, prevBeatPulse: 0, rafId: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight
    const ctx   = canvas.getContext('2d')!
    const state = stateRef.current

    // Pre-fill background so no flash on first reveal
    ctx.fillStyle = 'rgb(1,1,3)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const DEG   = Math.PI / 180
    const STEPS = 800

    const draw = () => {
      state.rafId = requestAnimationFrame(draw)

      const s = settingsRef.current
      const w = canvas.width
      const h = canvas.height
      const t = performance.now() / 1000

      // Phosphor persistence decay
      ctx.fillStyle = `rgba(1,1,3,${s.persistence})`
      ctx.fillRect(0, 0, w, h)

      const md         = window.__musicData
      const beatPulse  = md?.beatPulse ?? 0
      const loudness   = md?.loudness  ?? 0

      // Kick detection: rising edge → shift phaseX by beatKick degrees
      if (beatPulse > 0.8 && state.prevBeatPulse < 0.5) {
        state.phaseX += s.beatKick * DEG
      }
      state.prevBeatPulse = beatPulse

      const cx = w / 2
      const cy = h / 2
      const r  = Math.min(w, h) * 0.42

      // Thickness: base × loudness multiplier (0.5× at silence → 2× at peak)
      ctx.lineWidth   = s.thickness * (0.5 + 1.5 * Math.min(1, loudness))
      ctx.strokeStyle = s.color

      const phaseBase = s.phase * DEG
      const spinX     = t * s.spin
      const spinY     = t * s.spin * 0.6

      ctx.beginPath()
      for (let i = 0; i <= STEPS; i++) {
        const u = (i / STEPS) * Math.PI * 2
        const x = cx + r * Math.sin(s.freqX * u + spinX + state.phaseX + phaseBase)
        const y = cy + r * Math.sin(s.freqY * u + spinY)
        if (i === 0) ctx.moveTo(x, y)
        else         ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    state.rafId = requestAnimationFrame(draw)

    const handleResize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      ctx.fillStyle = 'rgb(1,1,3)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      cancelAnimationFrame(state.rafId)
      window.removeEventListener('resize', handleResize)
    }
  }, [settingsRef]) // settingsRef is stable — effectively []. RAF reads .current each frame.

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
