// Visualizer settings drawer: audio source, preset, speed, blend, shuffle.
//
// Audio sources (no installs, no cables):
//   - "Share tab / screen" — getDisplayMedia. Only offered where the
//     browser can share audio that way (desktop). Spotify's web player
//     is DRM-protected and shares as silence, so we point people at the
//     desktop app + "Entire screen" + "Share system audio".
//   - "Microphone" — getUserMedia. Works everywhere; default on phones.
// The last source used is remembered per device. A mic can resume on
// load; a screen share always needs a fresh click (browser rule).

import { useEffect, useMemo, useState } from 'react'
import { getVisualizerEngine, type VisualizerSettings } from './VisualizerEngine'
import { usePresetNames } from './usePresetNames'
import { canCaptureDisplayAudio, canCaptureMic, describeCaptureError } from './liveAudioCapture'
import Slider from '../../ui/Slider'

interface Props {
  isOpen: boolean
  onClose: () => void
  settings: VisualizerSettings
  selectedPreset: string
  onSettingsChange: (settings: Partial<VisualizerSettings>) => void
  onPresetChange: (preset: string) => void
  onLiveAudioChange?: (enabled: boolean) => void
}

type Source = 'tab' | 'mic'

const SOURCE_KEY = 'mheu_audio_source'
const LIVE_DEVICE_KEY = 'mheu_live_device_id'
const LIVE_ENABLED_KEY = 'mheu_live_audio_enabled'

const SHUFFLE_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 15, label: '15 s' },
  { value: 30, label: '30 s' },
  { value: 45, label: '45 s' },
  { value: 90, label: '90 s' },
  { value: 180, label: '3 min' },
]

function store(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* private mode */ }
}
function read(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

export default function GearMenu({
  isOpen, onClose, settings, selectedPreset, onSettingsChange, onPresetChange, onLiveAudioChange,
}: Props) {
  const engine = getVisualizerEngine()
  const presetKeys = useMemo(() => engine.getPresetKeys(), [engine])
  const { getDisplayName } = usePresetNames()
  const tabSupported = useMemo(canCaptureDisplayAudio, [])
  const micSupported = useMemo(canCaptureMic, [])

  const [active, setActive] = useState<Source | null>(() => (engine.isLiveAudioEnabled() ? (read(SOURCE_KEY) as Source) ?? 'mic' : null))
  const [preferred, setPreferred] = useState<Source>(() => {
    const saved = read(SOURCE_KEY)
    if (saved === 'tab' && tabSupported) return 'tab'
    if (saved === 'mic') return 'mic'
    return tabSupported ? 'tab' : 'mic'
  })
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [level, setLevel] = useState(0)

  function started(source: Source) {
    setActive(source)
    setPreferred(source)
    store(SOURCE_KEY, source)
    onLiveAudioChange?.(true)
  }

  // Resume a previously-enabled mic on load (permission is remembered by
  // the browser; if it was revoked this fails quietly).
  useEffect(() => {
    if (engine.isLiveAudioEnabled()) { onLiveAudioChange?.(true); return }
    if (!micSupported || read(LIVE_ENABLED_KEY) !== '1' || read(SOURCE_KEY) === 'tab') return
    engine.enableLiveAudio(read(LIVE_DEVICE_KEY) || undefined)
      .then(({ deviceId }) => { setDeviceId(deviceId); started('mic'); return engine.listAudioInputDevices() })
      .then(setDevices)
      .catch(() => store(LIVE_ENABLED_KEY, '0'))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function start(source: Source, newDevice?: string) {
    setError('')
    setBusy(true)
    try {
      if (source === 'tab') {
        await engine.enableTabAudio()
        store(LIVE_ENABLED_KEY, '0') // a share can't resume without a click
      } else {
        const { deviceId } = await engine.enableLiveAudio(newDevice)
        setDeviceId(deviceId)
        store(LIVE_DEVICE_KEY, deviceId)
        store(LIVE_ENABLED_KEY, '1')
        engine.listAudioInputDevices().then(setDevices).catch(() => {})
      }
      started(source)
    } catch (err) {
      setError(describeCaptureError(err, source))
      if (!engine.isLiveAudioEnabled()) { setActive(null); onLiveAudioChange?.(false) }
    }
    setBusy(false)
  }

  function stop() {
    engine.disableLiveAudio()
    setActive(null)
    store(LIVE_ENABLED_KEY, '0')
    onLiveAudioChange?.(false)
  }

  // Signal meter — proves audio is reaching the analyser.
  useEffect(() => {
    if (!isOpen || !active) return
    const id = setInterval(() => setLevel(engine.getCurrentSignalLevel()), 100)
    return () => clearInterval(id)
  }, [isOpen, active, engine])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const silent = active && level <= 0.02

  return (
    <>
      {isOpen && <div className="gear-backdrop" onClick={onClose} />}
      {/* inert while closed: keeps the off-screen drawer out of the tab order. */}
      <aside className={`gear${isOpen ? ' gear--open' : ''}`} aria-label="Visualizer settings" aria-hidden={!isOpen}
        {...(isOpen ? {} : { inert: '' })}>
        <div className="gear__head">
          <h2 className="eyebrow">Settings</h2>
          <span className="faint gear__count">{presetKeys.length} presets</span>
          <button type="button" className="btn btn--ghost btn--icon" onClick={onClose} aria-label="Close settings">✕</button>
        </div>

        <section className="gear__section" aria-labelledby="gear-audio">
          <h3 id="gear-audio" className="label">Audio source</h3>
          <div className="gear__sources" role="radiogroup" aria-label="Audio source">
            {tabSupported && (
              <button type="button" role="radio" aria-checked={preferred === 'tab'}
                className={`gear__source${active === 'tab' ? ' is-live' : ''}`} onClick={() => setPreferred('tab')}>
                Share tab / screen
              </button>
            )}
            <button type="button" role="radio" aria-checked={preferred === 'mic'} disabled={!micSupported}
              className={`gear__source${active === 'mic' ? ' is-live' : ''}`} onClick={() => setPreferred('mic')}>
              Microphone
            </button>
          </div>

          {preferred === 'tab' && (
            <p className="gear__hint">
              Spotify&apos;s web player shares as silence. Use the Spotify desktop app, pick
              “Entire screen”, and turn on “Share system audio”.
            </p>
          )}
          {preferred === 'mic' && <p className="gear__hint">Picks up whatever is playing in the room.</p>}

          {active === preferred ? (
            <button type="button" className="btn btn--outline btn--block" onClick={stop}>
              Stop {active === 'tab' ? 'sharing' : 'microphone'}
            </button>
          ) : (
            <button type="button" className="btn btn--primary btn--block" disabled={busy} onClick={() => start(preferred)}>
              {busy ? 'Starting…' : preferred === 'tab' ? 'Start sharing' : 'Start microphone'}
            </button>
          )}

          {active && (
            <div className="gear__row">
              <span className="label">Signal</span>
              <div className={`meter${silent ? ' meter--silent' : ''}`} role="meter" aria-label="Signal level"
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(100, level * 400))}>
                <div className="meter__fill" style={{ width: `${Math.min(100, level * 400)}%` }} />
              </div>
            </div>
          )}
          {silent && <p className="gear__hint">No sound yet — start playback, or check the share includes audio.</p>}

          {active === 'mic' && devices.length > 1 && (
            <label className="field">
              <span>Input</span>
              <select className="select" value={deviceId} onChange={e => start('mic', e.target.value)}>
                {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Input ${d.deviceId.slice(0, 6)}`}</option>)}
              </select>
            </label>
          )}
          {error && <p className="alert" role="alert">{error}</p>}
        </section>

        <section className="gear__section" aria-label="Visuals">
          <label className="field">
            <span>Preset</span>
            <select className="select" value={selectedPreset} onChange={e => onPresetChange(e.target.value)}>
              {presetKeys.map(k => <option key={k} value={k}>{getDisplayName(k)}</option>)}
            </select>
          </label>
          <Slider label="Anim speed" value={settings.animationSpeed} min={0.1} max={5} step={0.1} unit="×"
            onChange={v => onSettingsChange({ animationSpeed: v })} />
          <Slider label="Blend time" value={settings.blendTime} min={0.5} max={10} step={0.5} unit="s"
            onChange={v => onSettingsChange({ blendTime: v })} />
          <label className="field">
            <span>Auto-shuffle</span>
            <select className="select" value={settings.cycleSpeed}
              onChange={e => onSettingsChange({ cycleSpeed: Number(e.target.value) })}
              title="Random preset every N seconds while audio is playing. Pauses after 10 s of silence.">
              {SHUFFLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </section>
      </aside>
    </>
  )
}
