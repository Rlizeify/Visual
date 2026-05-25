import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { getVisualizerEngine, type VisualizerSettings } from '../../../features/visualizer/VisualizerEngine'
import { usePresetNames } from '../../../features/visualizer/usePresetNames'
import Slider from '../../../ui/Slider'

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
 * AC-130 Thermal — GearMenu ("AMMO BAY" drawer).
 *
 * Slides in from the right as a HUD-framed black panel. Same audio
 * engine wiring as Frutiger Aero / Asian Vibrant — only chrome
 * differs. Section labels are bracketed all-caps tokens; controls
 * are wire buttons + monospace selects.
 */
export default function AC130ThermalGearMenu({
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
  const { getDisplayName } = usePresetNames()

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
    }, 120)
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

  // ---- styles ----------------------------------------------------------

  const panelStyle: CSSProperties = {
    position: 'fixed',
    top: '70px',
    right: 0,
    width: '320px',
    maxHeight: 'calc(100vh - 90px)',
    background: 'var(--ac-panel-deep)',
    backgroundImage: 'var(--ac-scanline-bg)',
    border: '1px solid var(--ac-frame-wire)',
    borderRight: 'none',
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    overflowY: 'auto',
    zIndex: 1600,
    transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
    transition: 'transform 0.30s linear',
    pointerEvents: isOpen ? 'auto' : 'none',
    boxShadow: '-8px 0 24px -10px rgba(0,255,65,0.18), inset 1px 0 0 var(--ac-frame-bracket)',
    color: 'var(--ac-hud-green)',
    fontFamily: 'var(--ac-font-mono)',
  }

  const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '8px',
    borderBottom: '1px solid var(--ac-frame-wire)',
  }

  const labelStyle: CSSProperties = {
    display: 'block',
    color: 'var(--ac-hud-green-dim)',
    fontSize: '9px',
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    marginBottom: '6px',
    fontFamily: 'var(--ac-font-mono)',
  }

  const rowLabelStyle: CSSProperties = {
    width: '76px',
    fontSize: '9px',
    color: 'var(--ac-hud-green-dim)',
    fontFamily: 'var(--ac-font-mono)',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    flexShrink: 0,
  }

  const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px' }

  const dividerStyle: CSSProperties = {
    height: '1px',
    background: 'var(--ac-frame-wire)',
    margin: '4px 0',
  }

  const inkButton = (active: boolean): CSSProperties => ({
    flex: 1,
    background: active ? 'var(--ac-hud-green-wash)' : 'transparent',
    border: `1px solid ${active ? 'var(--ac-hud-green)' : 'var(--ac-frame-wire)'}`,
    color: active ? 'var(--ac-hud-green-bright)' : 'var(--ac-hud-green)',
    fontSize: '10px',
    fontFamily: 'var(--ac-font-mono)',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    padding: '6px 0',
    cursor: 'pointer',
    borderRadius: 0,
    transition: 'all 150ms linear',
    textShadow: active ? '0 0 4px rgba(0,255,65,0.55)' : 'none',
  })

  const selectStyle: CSSProperties = {
    flex: 1,
    background: 'var(--ac-panel-dim)',
    border: '1px solid var(--ac-frame-wire)',
    color: 'var(--ac-hud-green)',
    fontSize: '11px',
    fontFamily: 'var(--ac-font-mono)',
    padding: '5px 6px',
    borderRadius: 0,
    letterSpacing: '0.08em',
    outline: 'none',
  }

  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, background: 'transparent', zIndex: 1500 }}
        />
      )}

      <div className="ac-hud-frame" style={panelStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <span style={{
            fontFamily: 'var(--ac-font-mono)',
            fontSize: '12px',
            letterSpacing: '0.22em',
            color: 'var(--ac-hud-green-bright)',
            textShadow: '0 0 6px rgba(0,255,65,0.45)',
            textTransform: 'uppercase',
          }}>
            [ AMMO BAY / SETTINGS ]
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid var(--ac-frame-wire)',
              color: 'var(--ac-hud-green)',
              cursor: 'pointer',
              padding: '2px 8px',
              fontFamily: 'var(--ac-font-mono)',
              fontSize: '11px',
              letterSpacing: '0.15em',
              borderRadius: 0,
            }}
            aria-label="Close settings"
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Live audio */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={labelStyle}>[ LIVE AUDIO INTAKE ]</span>

          <div style={rowStyle}>
            <span style={rowLabelStyle}>SYSTEM</span>
            {liveEnabled && liveMode === 'system' ? (
              <button onClick={handleDisableLive} style={inkButton(true)}>
                [ ACTIVE — TAP TO STOP ]
              </button>
            ) : (
              <button onClick={handleEnableLive} style={inkButton(false)}>
                [ ARM SYSTEM AUDIO ]
              </button>
            )}
          </div>

          <div style={rowStyle}>
            <span style={rowLabelStyle}>OR TAB</span>
            {liveEnabled && liveMode === 'tab' ? (
              <button onClick={handleDisableLive} style={inkButton(true)}>
                [ TAB CAPTURE ON ]
              </button>
            ) : (
              <button onClick={handleEnableTab} style={inkButton(false)}>
                [ CAPTURE TAB AUDIO ]
              </button>
            )}
          </div>

          {liveEnabled && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ ...rowLabelStyle, fontSize: 9 }}>SIGNAL</span>
              <div style={{
                flex: 1,
                height: 6,
                background: 'var(--ac-panel-dim)',
                border: '1px solid var(--ac-frame-wire)',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 0,
              }}>
                <div style={{
                  position: 'absolute',
                  left: 0, top: 0, bottom: 0,
                  width: `${Math.min(100, signalLevel * 400)}%`,
                  background: signalLevel > 0.02 ? 'var(--ac-hud-green)' : 'var(--ac-amber)',
                  transition: 'width 80ms linear',
                  boxShadow: signalLevel > 0.02 ? '0 0 4px rgba(0,255,65,0.55)' : 'none',
                }} />
              </div>
            </div>
          )}

          {liveEnabled && liveMode === 'system' && (
            <div style={rowStyle}>
              <span style={rowLabelStyle}>INPUT</span>
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
            <span style={{
              color: 'var(--ac-hud-green-dim)',
              fontSize: 10,
              lineHeight: 1.5,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
            }}>
              CAPTURING: {(engine.getLiveDeviceLabel() || 'tab audio').toUpperCase()}
            </span>
          )}

          {liveError && (
            <span style={{
              color: 'var(--ac-ir-red)',
              fontSize: 10,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              textShadow: '0 0 4px rgba(255,42,26,0.45)',
            }}>
              FAULT: {liveError.toUpperCase()}
            </span>
          )}

          {!liveEnabled && (
            <span style={{
              color: 'var(--ac-hud-green-dim)',
              fontSize: 10,
              lineHeight: 1.5,
              letterSpacing: '0.05em',
            }}>
              SYSTEM uses BlackHole / VB-Cable. TAB asks Chrome for a tab + "Share tab audio" — no install needed.
            </span>
          )}
        </div>

        <div style={dividerStyle} />

        {/* Preset */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={labelStyle}>[ PATTERN BANK ]</span>
          <div style={rowStyle}>
            <span style={rowLabelStyle}>SELECT</span>
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

        <div style={dividerStyle} />

        {/* Motion */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={labelStyle}>[ MOTION TUNING ]</span>
          <Slider
            label="ANIM SPD"
            value={settings.animationSpeed}
            min={0.1}
            max={5}
            step={0.1}
            unit="x"
            onChange={v => onSettingsChange({ animationSpeed: v })}
          />
          <Slider
            label="BLEND"
            value={settings.blendTime}
            min={0.5}
            max={10}
            step={0.5}
            unit="s"
            onChange={v => onSettingsChange({ blendTime: v })}
          />
          <Slider
            label="CYCLE"
            value={settings.cycleSpeed}
            min={5}
            max={300}
            step={5}
            unit="s"
            onChange={v => onSettingsChange({ cycleSpeed: v })}
          />
        </div>

        {onLogout && (
          <>
            <div style={dividerStyle} />
            <button
              onClick={onLogout}
              className="ac-wire-button ac-wire-button--danger"
              style={{ width: '100%' }}
            >
              [ EJECT — SIGN OUT ]
            </button>
          </>
        )}
      </div>
    </>
  )
}
