import React from 'react'

export type WaveType = 'sine' | 'saw' | 'triangle' | 'square'

export interface OscillatorLayerConfig {
  waveType: WaveType
  frequency: number
  gain: number
  detune: number
  enabled: boolean
}

interface Props {
  id: string
  waveType: WaveType
  frequency: number
  gain: number
  detune: number
  enabled: boolean
  onChange: (id: string, config: Partial<OscillatorLayerConfig>) => void
  onRemove: (id: string) => void
}

const WAVE_LABELS: Record<WaveType, string> = { sine: 'SINE', saw: 'SAW', triangle: 'TRI', square: 'SQR' }
const WAVE_TYPES: WaveType[] = ['sine', 'saw', 'triangle', 'square']

export default function OscillatorLayer({ id, waveType, frequency, gain, detune, enabled, onChange, onRemove }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderBottom: '1px solid #2a2a2a' }}>
      <button
        onClick={() => onChange(id, { enabled: !enabled })}
        style={{
          width: 36, height: 24, cursor: 'pointer', fontFamily: 'monospace', fontSize: 11,
          background: enabled ? '#1a4a1a' : '#2a2a2a', color: enabled ? '#4f4' : '#666',
          border: `1px solid ${enabled ? '#4f4' : '#444'}`, flexShrink: 0,
        }}
      >
        {enabled ? 'ON' : 'OFF'}
      </button>

      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        {WAVE_TYPES.map(w => (
          <button
            key={w}
            onClick={() => onChange(id, { waveType: w })}
            style={{
              width: 36, height: 24, cursor: 'pointer', fontFamily: 'monospace', fontSize: 11,
              background: waveType === w ? '#2a2a3a' : '#1a1a1a',
              color: waveType === w ? '#aaf' : '#666',
              border: `1px solid ${waveType === w ? '#66a' : '#333'}`,
            }}
          >
            {WAVE_LABELS[w]}
          </button>
        ))}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'monospace', fontSize: 11, color: '#999', flexShrink: 0 }}>
        FREQ
        <input
          type="number"
          value={frequency}
          min={20}
          max={20000}
          step={1}
          onChange={e => onChange(id, { frequency: Number(e.target.value) })}
          style={{ width: 68, fontFamily: 'monospace', fontSize: 11, background: '#111', color: '#ddd', border: '1px solid #444', padding: '2px 4px' }}
        />
        <span style={{ color: '#555' }}>Hz</span>
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'monospace', fontSize: 11, color: '#999' }}>
        GAIN
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={gain}
          onChange={e => onChange(id, { gain: Number(e.target.value) })}
          style={{ width: 80 }}
        />
        <span style={{ color: '#555', minWidth: 32 }}>{gain.toFixed(2)}</span>
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'monospace', fontSize: 11, color: '#999', flexShrink: 0 }}>
        DETUNE
        <input
          type="number"
          value={detune}
          min={-1200}
          max={1200}
          step={1}
          onChange={e => onChange(id, { detune: Number(e.target.value) })}
          style={{ width: 56, fontFamily: 'monospace', fontSize: 11, background: '#111', color: '#ddd', border: '1px solid #444', padding: '2px 4px' }}
        />
        <span style={{ color: '#555' }}>¢</span>
      </label>

      <button
        onClick={() => onRemove(id)}
        style={{
          marginLeft: 'auto', width: 24, height: 24, cursor: 'pointer',
          fontFamily: 'monospace', fontSize: 14, lineHeight: 1,
          background: '#200', color: '#f66', border: '1px solid #522', flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  )
}
