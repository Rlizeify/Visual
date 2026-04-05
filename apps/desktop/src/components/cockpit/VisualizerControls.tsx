import { useMemo } from 'react'
import butterchurnPresets from 'butterchurn-presets'

interface Props {
  selectedPreset: string
  blendTime: number
  cycleSpeed: number
  bassReactivity: number
  midReactivity: number
  highReactivity: number
  onPresetChange: (v: string) => void
  onBlendTime: (v: number) => void
  onCycleSpeed: (v: number) => void
  onBass: (v: number) => void
  onMid: (v: number) => void
  onHigh: (v: number) => void
}

const lbl: React.CSSProperties = { width: 88, fontSize: 10, color: '#7a0105', fontFamily: 'monospace', letterSpacing: '0.06em', flexShrink: 0 }
const num: React.CSSProperties = { width: 44, background: '#010103', border: '1px solid #7a0105', color: '#27e0e1', fontSize: 10, fontFamily: 'monospace', textAlign: 'right', padding: '1px 3px', borderRadius: 0 }
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px' }

function Row({ label, val, min, max, unit, cb }: { label: string; val: number; min: number; max: number; unit: string; cb: (v: number) => void }) {
  return (
    <div style={row}>
      <span style={lbl}>{label}</span>
      <input type="range" min={min} max={max} step={(max - min) / 100} value={val}
        onChange={e => cb(Number(e.target.value))}
        style={{ flex: 1, accentColor: '#eea91c', height: 3, cursor: 'pointer' }} />
      <input type="number" min={min} max={max} step={(max - min) / 100} value={val}
        onChange={e => cb(Number(e.target.value))} style={num} />
      <span style={{ fontSize: 9, color: '#7a0105', minWidth: 16 }}>{unit}</span>
    </div>
  )
}

export default function VisualizerControls(p: Props) {
  const keys = useMemo(() => Object.keys(butterchurnPresets.getPresets()), [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'auto', height: '100%', paddingTop: 28 }}>
      <div style={row}>
        <span style={lbl}>PRESET</span>
        <select value={p.selectedPreset} onChange={e => p.onPresetChange(e.target.value)}
          style={{ flex: 1, background: '#010103', border: '1px solid #7a0105', color: '#eea91c', fontSize: 10, fontFamily: 'monospace', padding: '1px 2px', borderRadius: 0 }}>
          {keys.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
      <Row label="BASS REACT" val={p.bassReactivity} min={0} max={100} unit="%" cb={p.onBass} />
      <Row label="MID REACT"  val={p.midReactivity}  min={0} max={100} unit="%" cb={p.onMid} />
      <Row label="HIGH REACT" val={p.highReactivity} min={0} max={100} unit="%" cb={p.onHigh} />
      <Row label="BLEND TIME" val={p.blendTime}       min={1} max={10}  unit="s" cb={p.onBlendTime} />
      <Row label="CYCLE SPD"  val={p.cycleSpeed}      min={10} max={120} unit="s" cb={p.onCycleSpeed} />
    </div>
  )
}
