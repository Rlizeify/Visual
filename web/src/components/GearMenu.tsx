import { useMemo } from 'react'
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
