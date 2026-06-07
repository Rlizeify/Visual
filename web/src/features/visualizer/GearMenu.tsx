import { useEffect, useMemo, useState } from 'react'
import { getVisualizerEngine, VisualizerSettings } from './VisualizerEngine'
import { usePresetNames } from './usePresetNames'
import Slider from '../../ui/Slider'

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

const labelStyle: React.CSSProperties = {
  width: '90px',
  fontSize: '11px',
  color: 'var(--accent-color)',
  fontFamily: "'HitmarkerText', monospace",
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  flexShrink: 0,
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
}

export default function GearMenu({
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

  // Auto-restore live audio on mount if user previously enabled it
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
      .catch(() => { /* user must re-grant permission via the toggle */ })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function refreshDevices() {
    try {
      const devices = await engine.listAudioInputDevices()
      setLiveDevices(devices)
    } catch {
      // ignore
    }
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
      // Don't persist tab mode — getDisplayMedia requires a fresh user gesture each session
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

  // Poll the engine for live signal level so the meter responds to actual audio.
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

  return (
    <>
      {/* Invisible backdrop to close menu */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'transparent',
            zIndex: 1500,
          }}
        />
      )}

      {/* Panel - slides in from right */}
      <div
        style={{
          position: 'fixed',
          top: '70px',
          right: 0,
          width: '280px',
          maxHeight: 'calc(100vh - 90px)',
          // Glass surface: user-accent wash over dark frost base.
          background:
            'linear-gradient(0deg, var(--user-accent-glass), var(--user-accent-glass)),' +
            ' rgba(0, 20, 30, 0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--accent-color-border)',
          borderRight: 'none',
          borderTopLeftRadius: 'var(--radius)',
          borderBottomLeftRadius: 'var(--radius)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          overflowY: 'auto',
          zIndex: 1600,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease',
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ color: 'var(--accent-color)', fontSize: '12px', fontFamily: "'HitmarkerText', monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            SETTINGS
          </span>
          <span
            style={{
              color: 'var(--accent-color-dim)',
              fontSize: '9px',
              fontFamily: "'HitmarkerText', monospace",
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginLeft: 'auto',
              marginRight: 8,
            }}
            title={`${presetCount} Butterchurn presets loaded`}
          >
            PRESETS: {presetCount}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid var(--accent-color-border)',
              color: 'var(--accent-color)',
              padding: '4px 10px',
              fontSize: '12px',
              fontFamily: "'HitmarkerText', monospace",
              cursor: 'pointer',
              borderRadius: 0,
            }}
          >
            X
          </button>
        </div>

        {/* Live audio (system loopback or tab capture) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 10, borderBottom: '1px solid var(--accent-color-bg)' }}>
          <div style={rowStyle}>
            <span style={labelStyle}>LIVE AUDIO</span>
            <button
              onClick={liveEnabled ? handleDisableLive : handleEnableLive}
              style={{
                flex: 1,
                background: liveEnabled && liveMode === 'system' ? 'var(--accent-color-bg)' : 'transparent',
                border: '1px solid var(--accent-color-dim)',
                color: 'var(--accent-color)',
                fontSize: '10px',
                fontFamily: "'HitmarkerText', monospace",
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '5px 0',
                cursor: 'pointer',
                borderRadius: 0,
              }}
            >
              {liveEnabled && liveMode === 'system'
                ? 'SYSTEM ON'
                : liveEnabled && liveMode === 'tab'
                  ? 'DISABLE'
                  : 'SYSTEM AUDIO'}
            </button>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>OR TAB</span>
            <button
              onClick={handleEnableTab}
              style={{
                flex: 1,
                background: liveEnabled && liveMode === 'tab' ? 'var(--accent-color-bg)' : 'transparent',
                border: '1px solid var(--accent-color-dim)',
                color: 'var(--accent-color)',
                fontSize: '10px',
                fontFamily: "'HitmarkerText', monospace",
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '5px 0',
                cursor: 'pointer',
                borderRadius: 0,
              }}
            >
              {liveEnabled && liveMode === 'tab' ? 'TAB ON' : 'CAPTURE TAB AUDIO'}
            </button>
          </div>

          {/* Signal level meter — proves audio is reaching the analyser */}
          {liveEnabled && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ ...labelStyle, fontSize: 9 }}>SIGNAL</span>
              <div style={{ flex: 1, height: 6, background: 'rgba(0, 30, 40, 0.8)', border: '1px solid var(--accent-color-border)', position: 'relative', overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute',
                  left: 0, top: 0, bottom: 0,
                  width: `${Math.min(100, signalLevel * 400)}%`,
                  background: signalLevel > 0.02 ? 'var(--accent-color)' : 'rgba(255, 100, 100, 0.6)',
                  transition: 'width 80ms linear',
                }} />
              </div>
            </div>
          )}

          {liveEnabled && liveMode === 'system' && (
            <div style={rowStyle}>
              <span style={labelStyle}>INPUT</span>
              <select
                value={liveDeviceId}
                onChange={e => handleDeviceChange(e.target.value)}
                onFocus={refreshDevices}
                style={{
                  flex: 1,
                  background: 'rgba(0, 20, 30, 0.8)',
                  border: '1px solid var(--accent-color-border)',
                  color: 'var(--accent-color)',
                  fontSize: '10px',
                  fontFamily: "'HitmarkerText', monospace",
                  padding: '4px',
                  borderRadius: 0,
                }}
              >
                {liveDevices.length === 0 && (
                  <option value={liveDeviceId}>{engine.getLiveDeviceLabel() || 'current input'}</option>
                )}
                {liveDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || `Input ${d.deviceId.slice(0, 6)}`}</option>
                ))}
              </select>
            </div>
          )}
          {liveEnabled && liveMode === 'tab' && (
            <span style={{ color: 'rgba(180, 240, 235, 0.7)', fontSize: 9, fontFamily: "'HitmarkerText', monospace", lineHeight: 1.4 }}>
              Capturing: {engine.getLiveDeviceLabel() || 'tab audio'}
            </span>
          )}
          {liveError && (
            <span style={{ color: 'rgba(255, 100, 100, 0.85)', fontSize: 10, fontFamily: "'HitmarkerText', monospace" }}>
              {liveError}
            </span>
          )}
          {!liveEnabled && (
            <span style={{ color: 'rgba(180, 240, 235, 0.55)', fontSize: 9, fontFamily: "'HitmarkerText', monospace", lineHeight: 1.4 }}>
              SYSTEM = BlackHole/VB-Cable. TAB = pick a Chrome tab and "Share tab audio" — no install needed.
            </span>
          )}
        </div>

        {/* Preset selector */}
        <div style={rowStyle}>
          <span style={labelStyle}>PRESET</span>
          <select
            value={selectedPreset}
            onChange={e => onPresetChange(e.target.value)}
            style={{
              flex: 1,
              background: 'rgba(0, 20, 30, 0.8)',
              border: '1px solid var(--accent-color-border)',
              color: 'var(--accent-color)',
              fontSize: '10px',
              fontFamily: "'HitmarkerText', monospace",
              padding: '4px',
              borderRadius: 0,
            }}
          >
            {presetKeys.map(k => (
              <option key={k} value={k}>{getDisplayName(k)}</option>
            ))}
          </select>
        </div>

        {/* Sliders */}
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
        {/* Auto-shuffle — random preset cycling with audio gating */}
        <div style={rowStyle}>
          <span style={labelStyle}>AUTO-SHUFFLE</span>
          <select
            value={settings.cycleSpeed}
            onChange={e => onSettingsChange({ cycleSpeed: Number(e.target.value) })}
            style={{
              flex: 1,
              background: 'rgba(0, 20, 30, 0.8)',
              border: '1px solid var(--accent-color-border)',
              color: 'var(--accent-color)',
              fontSize: '10px',
              fontFamily: "'HitmarkerText', monospace",
              padding: '4px',
              borderRadius: 0,
            }}
            title="Random preset every N seconds while audio is playing. Pauses after 10s of silence."
          >
            {SHUFFLE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Logout */}
        {onLogout && (
          <button
            onClick={onLogout}
            style={{
              marginTop: '4px',
              background: 'transparent',
              border: '1px solid rgba(255, 60, 60, 0.5)',
              color: 'rgba(255, 100, 100, 0.85)',
              fontSize: '11px',
              fontFamily: "'HitmarkerText', monospace",
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '6px 0',
              cursor: 'pointer',
              width: '100%',
              borderRadius: 0,
            }}
          >
            Logout
          </button>
        )}
      </div>
    </>
  )
}
