import { useMemo } from 'react'
import { getVisualizerEngine, VisualizerSettings } from '../audio/VisualizerEngine'

interface Props {
  isOpen: boolean
  onClose: () => void
  settings: VisualizerSettings
  selectedPreset: string
  onSettingsChange: (settings: Partial<VisualizerSettings>) => void
  onPresetChange: (preset: string) => void
}

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  width: '320px',
  height: '100vh',
  background: '#010103',
  borderLeft: '1px solid #7a0105',
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  overflowY: 'auto',
  zIndex: 1000,
}

const labelStyle: React.CSSProperties = {
  width: '90px',
  fontSize: '11px',
  color: '#7a0105',
  fontFamily: "'HitmarkerText', monospace",
  letterSpacing: '0.06em',
  flexShrink: 0,
}

const inputStyle: React.CSSProperties = {
  width: '52px',
  background: '#010103',
  border: '1px solid #7a0105',
  color: '#27e0e1',
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
  color: '#7a0105',
  minWidth: '16px',
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
}: Props) {
  const engine = getVisualizerEngine()
  const presetKeys = useMemo(() => engine.getPresetKeys(), [engine])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 999,
        }}
      />

      {/* Panel */}
      <div style={panelStyle}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ color: '#eea91c', fontSize: '14px', fontFamily: "'HitmarkerText', monospace" }}>
            VISUALIZER SETTINGS
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid #7a0105',
              color: '#eea91c',
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
              background: '#010103',
              border: '1px solid #7a0105',
              color: '#eea91c',
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
      </div>
    </>
  )
}
