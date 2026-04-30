import { useEffect, useMemo, useState } from 'react'
import { getVisualizerEngine, VisualizerSettings } from '../audio/VisualizerEngine'

interface Props {
  isOpen: boolean
  onClose: () => void
  settings: VisualizerSettings
  selectedPreset: string
  onSettingsChange: (settings: Partial<VisualizerSettings>) => void
  onPresetChange: (preset: string) => void
  onLogout?: () => void
}

const LIVE_DEVICE_KEY = 'mheu_live_device_id'
const LIVE_ENABLED_KEY = 'mheu_live_audio_enabled'

const labelStyle: React.CSSProperties = {
  width: '90px',
  fontSize: '11px',
  color: '#00dcc8',
  fontFamily: "'HitmarkerText', monospace",
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  flexShrink: 0,
}

const inputStyle: React.CSSProperties = {
  width: '52px',
  background: 'rgba(0, 20, 30, 0.8)',
  border: '1px solid rgba(0, 220, 200, 0.4)',
  color: '#00dcc8',
  fontSize: '11px',
  fontFamily: "'HitmarkerText', monospace",
  textAlign: 'right',
  padding: '2px 4px',
  borderRadius: 0,
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
}

const unitStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'rgba(180, 240, 235, 0.7)',
  minWidth: '16px',
  fontFamily: "'HitmarkerText', monospace",
}

interface RowProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
}

function Row({ label, value, min, max, step, unit, onChange }: RowProps) {
  return (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, height: '3px', cursor: 'pointer' }}
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={inputStyle}
      />
      <span style={unitStyle}>{unit}</span>
    </div>
  )
}

export default function GearMenu({
  isOpen,
  onClose,
  settings,
  selectedPreset,
  onSettingsChange,
  onPresetChange,
  onLogout,
}: Props) {
  const engine = getVisualizerEngine()
  const presetKeys = useMemo(() => engine.getPresetKeys(), [engine])

  const [liveEnabled, setLiveEnabled] = useState<boolean>(() => engine.isLiveAudioEnabled())
  const [liveDevices, setLiveDevices] = useState<MediaDeviceInfo[]>([])
  const [liveDeviceId, setLiveDeviceId] = useState<string>('')
  const [liveError, setLiveError] = useState<string>('')

  // Auto-restore live audio on mount if user previously enabled it
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return
    if (engine.isLiveAudioEnabled()) {
      setLiveEnabled(true)
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
      localStorage.setItem(LIVE_ENABLED_KEY, '1')
      localStorage.setItem(LIVE_DEVICE_KEY, deviceId)
      await refreshDevices()
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : 'Failed to enable live audio')
      setLiveEnabled(false)
    }
  }

  function handleDisableLive() {
    engine.disableLiveAudio()
    setLiveEnabled(false)
    setLiveDeviceId('')
    localStorage.setItem(LIVE_ENABLED_KEY, '0')
  }

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
            zIndex: 999,
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
          background: 'rgba(0, 20, 30, 0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(0, 220, 200, 0.4)',
          borderRight: 'none',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          overflowY: 'auto',
          zIndex: 1000,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease',
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ color: '#00dcc8', fontSize: '12px', fontFamily: "'HitmarkerText', monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            SETTINGS
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid rgba(0, 220, 200, 0.4)',
              color: '#00dcc8',
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

        {/* Live audio (system audio loopback) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 10, borderBottom: '1px solid rgba(0, 220, 200, 0.2)' }}>
          <div style={rowStyle}>
            <span style={labelStyle}>LIVE AUDIO</span>
            <button
              onClick={liveEnabled ? handleDisableLive : handleEnableLive}
              style={{
                flex: 1,
                background: liveEnabled ? 'rgba(0, 220, 200, 0.2)' : 'transparent',
                border: '1px solid rgba(0, 220, 200, 0.5)',
                color: '#00dcc8',
                fontSize: '11px',
                fontFamily: "'HitmarkerText', monospace",
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding: '5px 0',
                cursor: 'pointer',
                borderRadius: 0,
              }}
            >
              {liveEnabled ? 'ON — CLICK TO DISABLE' : 'OFF — CLICK TO ENABLE'}
            </button>
          </div>
          {liveEnabled && (
            <div style={rowStyle}>
              <span style={labelStyle}>INPUT</span>
              <select
                value={liveDeviceId}
                onChange={e => handleDeviceChange(e.target.value)}
                onFocus={refreshDevices}
                style={{
                  flex: 1,
                  background: 'rgba(0, 20, 30, 0.8)',
                  border: '1px solid rgba(0, 220, 200, 0.4)',
                  color: '#00dcc8',
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
          {liveError && (
            <span style={{ color: 'rgba(255, 100, 100, 0.85)', fontSize: 10, fontFamily: "'HitmarkerText', monospace" }}>
              {liveError}
            </span>
          )}
          {!liveEnabled && (
            <span style={{ color: 'rgba(180, 240, 235, 0.55)', fontSize: 9, fontFamily: "'HitmarkerText', monospace", lineHeight: 1.4 }}>
              Use BlackHole + Multi-Output Device to feed system audio into the visualizer.
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
              border: '1px solid rgba(0, 220, 200, 0.4)',
              color: '#00dcc8',
              fontSize: '10px',
              fontFamily: "'HitmarkerText', monospace",
              padding: '4px',
              borderRadius: 0,
            }}
          >
            {presetKeys.map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>

        {/* Sliders */}
        <Row
          label="BASS REACT"
          value={settings.bassReactivity}
          min={0}
          max={100}
          step={1}
          unit="%"
          onChange={v => onSettingsChange({ bassReactivity: v })}
        />
        <Row
          label="MID REACT"
          value={settings.midReactivity}
          min={0}
          max={100}
          step={1}
          unit="%"
          onChange={v => onSettingsChange({ midReactivity: v })}
        />
        <Row
          label="HIGH REACT"
          value={settings.highReactivity}
          min={0}
          max={100}
          step={1}
          unit="%"
          onChange={v => onSettingsChange({ highReactivity: v })}
        />
        <Row
          label="ANIM SPEED"
          value={settings.animationSpeed}
          min={0.1}
          max={5}
          step={0.1}
          unit="x"
          onChange={v => onSettingsChange({ animationSpeed: v })}
        />
        <Row
          label="BLEND TIME"
          value={settings.blendTime}
          min={0.5}
          max={10}
          step={0.5}
          unit="s"
          onChange={v => onSettingsChange({ blendTime: v })}
        />
        <Row
          label="CYCLE SPD"
          value={settings.cycleSpeed}
          min={5}
          max={300}
          step={5}
          unit="s"
          onChange={v => onSettingsChange({ cycleSpeed: v })}
        />

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
