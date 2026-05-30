import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { getVisualizerEngine, type VisualizerSettings } from '../../../features/visualizer/VisualizerEngine'
import { usePresetNames } from '../../../features/visualizer/usePresetNames'
import Slider from '../../../ui/Slider'
import { CloseBrush, Hanko } from './BrushIcons'

interface Props {
  isOpen: boolean
  onClose: () => void
  settings: VisualizerSettings
  selectedPreset: string
  onSettingsChange: (settings: Partial<VisualizerSettings>) => void
  onPresetChange: (preset: string) => void
  onLiveAudioChange?: (enabled: boolean) => void
  onLogout?: () => void
}

const LIVE_DEVICE_KEY = 'mheu_live_device_id'
const LIVE_ENABLED_KEY = 'mheu_live_audio_enabled'

/**
 * Asian Vibrant GearMenu (rebuild).
 *
 * Ink-painted side panel sliding from the right. Rice paper face
 * with ink-line dividers between sections.
 *
 * Single kanji glyph in this panel: the 設 hanko in the title.
 * Subsections use plain Latin labels (.av-label) — the rebuild
 * removes 音 / 幻 / 動 / 退 chrome glyphs that competed with
 * Latin meaning.
 *
 * Audio engine wiring identical to Frutiger Aero — only chrome differs.
 */
export default function AsianVibrantGearMenu({
  isOpen,
  onClose,
  settings,
  selectedPreset,
  onSettingsChange,
  onPresetChange,
  onLiveAudioChange,
  onLogout,
}: Props) {
  const engine = getVisualizerEngine()
  const presetKeys = useMemo(() => engine.getPresetKeys(), [engine])
  const presetCount = presetKeys.length
  const { getDisplayName } = usePresetNames()

  const SHUFFLE_OPTIONS: { value: number; label: string }[] = [
    { value: 0,   label: 'OFF'   },
    { value: 15,  label: '15s'   },
    { value: 30,  label: '30s'   },
    { value: 45,  label: '45s'   },
    { value: 90,  label: '90s'   },
    { value: 180, label: '3 min' },
  ]

  const [liveEnabled, setLiveEnabled] = useState<boolean>(() => engine.isLiveAudioEnabled())
  const [liveDevices, setLiveDevices] = useState<MediaDeviceInfo[]>([])
  const [liveDeviceId, setLiveDeviceId] = useState<string>('')
  const [liveError, setLiveError] = useState<string>('')
  const [liveMode, setLiveMode] = useState<'system' | 'tab'>('system')
  const [signalLevel, setSignalLevel] = useState<number>(0)

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return
    if (engine.isLiveAudioEnabled()) {
      setLiveEnabled(true)
      onLiveAudioChange?.(true)
      return
    }
    const wasEnabled = localStorage.getItem(LIVE_ENABLED_KEY) === '1'
    if (!wasEnabled) return
    const savedId = localStorage.getItem(LIVE_DEVICE_KEY) || undefined
    engine
      .enableLiveAudio(savedId)
      .then(({ deviceId }) => {
        setLiveEnabled(true)
        setLiveDeviceId(deviceId)
        onLiveAudioChange?.(true)
        return engine.listAudioInputDevices()
      })
      .then(devices => { if (devices) setLiveDevices(devices) })
      .catch(() => { /* user must re-grant */ })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function refreshDevices() {
    try {
      const devices = await engine.listAudioInputDevices()
      setLiveDevices(devices)
    } catch { /* ignore */ }
  }

  async function handleEnableLive() {
    setLiveError('')
    try {
      const { deviceId } = await engine.enableLiveAudio()
      setLiveEnabled(true)
      setLiveDeviceId(deviceId)
      setLiveMode('system')
      onLiveAudioChange?.(true)
      localStorage.setItem(LIVE_ENABLED_KEY, '1')
      localStorage.setItem(LIVE_DEVICE_KEY, deviceId)
      await refreshDevices()
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : 'Failed to enable live audio')
      setLiveEnabled(false)
      onLiveAudioChange?.(false)
    }
  }

  async function handleEnableTab() {
    setLiveError('')
    try {
      await engine.enableTabAudio()
      setLiveEnabled(true)
      setLiveDeviceId('')
      setLiveMode('tab')
      onLiveAudioChange?.(true)
      localStorage.setItem(LIVE_ENABLED_KEY, '0')
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : 'Failed to capture tab audio')
      setLiveEnabled(false)
      onLiveAudioChange?.(false)
    }
  }

  function handleDisableLive() {
    engine.disableLiveAudio()
    setLiveEnabled(false)
    setLiveDeviceId('')
    onLiveAudioChange?.(false)
    localStorage.setItem(LIVE_ENABLED_KEY, '0')
  }

  useEffect(() => {
    if (!isOpen || !liveEnabled) return
    const id = setInterval(() => {
      setSignalLevel(engine.getCurrentSignalLevel())
    }, 100)
    return () => clearInterval(id)
  }, [isOpen, liveEnabled, engine])

  async function handleDeviceChange(newId: string) {
    setLiveError('')
    try {
      const { deviceId } = await engine.enableLiveAudio(newId)
      setLiveDeviceId(deviceId)
      localStorage.setItem(LIVE_DEVICE_KEY, deviceId)
      localStorage.setItem(LIVE_ENABLED_KEY, '1')
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : 'Failed to switch device')
    }
  }

  // ---- styles ---------------------------------------------------------

  const panelStyle: CSSProperties = {
    position: 'fixed',
    top: '70px',
    right: 0,
    width: '300px',
    maxHeight: 'calc(100vh - 90px)',
    background:
      'linear-gradient(180deg, var(--av-paper) 0%, var(--av-paper-soft) 100%)',
    borderTop: '1px solid var(--av-gold-deep)',
    borderBottom: '1px solid var(--av-gold-deep)',
    borderLeft: '1px solid var(--av-gold)',
    borderTopLeftRadius: 'var(--radius)',
    borderBottomLeftRadius: 'var(--radius)',
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    overflowY: 'auto',
    zIndex: 1600,
    transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
    transition: 'transform 0.34s cubic-bezier(0.4, 0, 0.2, 1)',
    pointerEvents: isOpen ? 'auto' : 'none',
    boxShadow:
      '-8px 0 24px -10px rgba(26,20,16,0.45), inset 1px 0 0 var(--av-gold-deep)',
    color: 'var(--av-ink)',
    fontFamily: 'var(--av-font-body)',
  }

  const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2px',
    paddingBottom: '8px',
    borderBottom: '1px solid var(--av-gold-deep)',
  }

  const rowLabelStyle: CSSProperties = {
    width: '88px',
    fontSize: '10px',
    color: 'var(--av-ink-soft)',
    fontFamily: 'var(--av-font-body)',
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    flexShrink: 0,
  }

  const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px' }

  const inkButton = (active: boolean): CSSProperties => ({
    flex: 1,
    background: active ? 'var(--av-crimson)' : 'transparent',
    border: `1px solid ${active ? 'var(--av-gold)' : 'var(--av-ink-soft)'}`,
    color: active ? 'var(--av-paper)' : 'var(--av-ink)',
    fontSize: '10px',
    fontFamily: 'var(--av-font-body)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '6px 0',
    cursor: 'pointer',
    borderRadius: '3px',
    transition: 'background 180ms ease, color 180ms ease',
  })

  const selectStyle: CSSProperties = {
    flex: 1,
    background: 'var(--av-paper-soft)',
    border: '1px solid var(--av-ink-soft)',
    color: 'var(--av-ink)',
    fontSize: '11px',
    fontFamily: 'var(--av-font-body)',
    padding: '5px',
    borderRadius: '3px',
  }

  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, background: 'transparent', zIndex: 1500 }}
        />
      )}

      <div style={panelStyle}>
        {/* Header — the ONE kanji this panel spends. */}
        <div style={headerStyle}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            fontFamily: 'var(--av-font-display)',
            fontSize: '15px',
            letterSpacing: '0.08em',
            color: 'var(--av-crimson-deep)',
          }}>
            <Hanko glyph="設" size={22} />
            Settings
          </span>
          <span
            style={{
              fontFamily: 'var(--av-font-display)',
              fontSize: '10px',
              letterSpacing: '0.08em',
              color: 'var(--av-ink-soft)',
              opacity: 0.65,
              marginLeft: 'auto',
              marginRight: 8,
            }}
            title={`${presetCount} Butterchurn presets loaded`}
          >
            PRESETS · {presetCount}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--av-ink-soft)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close settings"
          >
            <CloseBrush size={20} />
          </button>
        </div>

        {/* Live audio */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="av-label">Live Audio</span>

          <div style={rowStyle}>
            <span style={rowLabelStyle}>System</span>
            {liveEnabled && liveMode === 'system' ? (
              <button onClick={handleDisableLive} style={inkButton(true)}>
                Active — Tap to stop
              </button>
            ) : (
              <button onClick={handleEnableLive} style={inkButton(false)}>
                Enable system audio
              </button>
            )}
          </div>

          <div style={rowStyle}>
            <span style={rowLabelStyle}>Or Tab</span>
            {liveEnabled && liveMode === 'tab' ? (
              <button onClick={handleDisableLive} style={inkButton(true)}>
                Tab capture on
              </button>
            ) : (
              <button onClick={handleEnableTab} style={inkButton(false)}>
                Capture tab audio
              </button>
            )}
          </div>

          {liveEnabled && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ ...rowLabelStyle, fontSize: 9 }}>Signal</span>
              <div style={{
                flex: 1,
                height: 6,
                background: 'var(--av-paper-soft)',
                border: '1px solid var(--av-ink-soft)',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '2px',
              }}>
                <div style={{
                  position: 'absolute',
                  left: 0, top: 0, bottom: 0,
                  width: `${Math.min(100, signalLevel * 400)}%`,
                  background: signalLevel > 0.02 ? 'var(--av-jade)' : 'var(--av-vermillion)',
                  transition: 'width 80ms linear',
                }} />
              </div>
            </div>
          )}

          {liveEnabled && liveMode === 'system' && (
            <div style={rowStyle}>
              <span style={rowLabelStyle}>Input</span>
              <select
                value={liveDeviceId}
                onChange={e => handleDeviceChange(e.target.value)}
                onFocus={refreshDevices}
                style={selectStyle}
              >
                {liveDevices.length === 0 && (
                  <option value={liveDeviceId}>{engine.getLiveDeviceLabel() || 'current input'}</option>
                )}
                {liveDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Input ${d.deviceId.slice(0, 6)}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {liveEnabled && liveMode === 'tab' && (
            <span style={{ color: 'var(--av-ink-soft)', fontSize: 10, lineHeight: 1.5 }}>
              Capturing: {engine.getLiveDeviceLabel() || 'tab audio'}
            </span>
          )}

          {liveError && (
            <span style={{ color: 'var(--av-vermillion)', fontSize: 10 }}>
              {liveError}
            </span>
          )}

          {!liveEnabled && (
            <span style={{ color: 'var(--av-ink-soft)', fontSize: 10, lineHeight: 1.5 }}>
              SYSTEM uses BlackHole / VB-Cable. TAB asks Chrome for a tab and "Share tab audio" — no install needed.
            </span>
          )}
        </div>

        <div className="av-ink-divider" />

        {/* Preset */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="av-label">Preset</span>
          <div style={rowStyle}>
            <span style={rowLabelStyle}>Pattern</span>
            <select
              value={selectedPreset}
              onChange={e => onPresetChange(e.target.value)}
              style={selectStyle}
            >
              {presetKeys.map(k => (
                <option key={k} value={k}>{getDisplayName(k)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="av-ink-divider" />

        {/* Motion */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="av-label">Motion</span>
          <Slider
            label="ANIM SPEED"
            value={settings.animationSpeed}
            min={0.1}
            max={5}
            step={0.1}
            unit="x"
            onChange={v => onSettingsChange({ animationSpeed: v })}
          />
          <Slider
            label="BLEND TIME"
            value={settings.blendTime}
            min={0.5}
            max={10}
            step={0.5}
            unit="s"
            onChange={v => onSettingsChange({ blendTime: v })}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="av-label">AUTO-SHUFFLE</span>
            <select
              value={settings.cycleSpeed}
              onChange={e => onSettingsChange({ cycleSpeed: Number(e.target.value) })}
              title="Random preset every N seconds while audio is playing. Pauses after 10s of silence."
              style={{
                background: 'rgba(255, 250, 240, 0.6)',
                border: '1px solid var(--av-ink-soft)',
                color: 'var(--av-ink-deep)',
                fontFamily: 'var(--av-font-display)',
                fontSize: 12,
                padding: '4px 6px',
                borderRadius: 0,
                cursor: 'pointer',
              }}
            >
              {SHUFFLE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {onLogout && (
          <>
            <div className="av-ink-divider" />
            <button
              onClick={onLogout}
              className="av-brush-button av-brush-button--ghost"
              style={{ width: '100%' }}
            >
              Logout
            </button>
          </>
        )}
      </div>
    </>
  )
}
