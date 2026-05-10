import { colors, fonts } from '../../styles/tokens'
import Slider from '../../ui/Slider'
import { OSCI_COLORS, type OsciSettings } from './types'

interface OsciPanelProps {
  settings: OsciSettings
  onChange: (s: OsciSettings) => void
}

export default function OsciPanel({ settings, onChange }: OsciPanelProps) {
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
      border: `1px solid ${colors.tealPrimary}`,
      borderRadius: 0,
      padding: '12px 14px',
      fontFamily: fonts.mono,
      boxShadow: 'var(--accent-color-glow) 0 0 20px',
      pointerEvents: 'auto',
    }}>
      <div style={{
        color: colors.tealPrimary,
        fontSize: 11,
        letterSpacing: '0.18em',
        fontFamily: fonts.mono,
        marginBottom: 12,
        borderBottom: `1px solid ${colors.panelBorder}`,
        paddingBottom: 7,
        userSelect: 'none',
      }}>
        OSCI RENDER
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Slider label="FREQ X"      value={settings.freqX}       min={0.5}  max={10}  step={0.1}  unit=""   onChange={v => set('freqX', v)} />
        <Slider label="FREQ Y"      value={settings.freqY}       min={0.5}  max={10}  step={0.1}  unit=""   onChange={v => set('freqY', v)} />
        <Slider label="PHASE"       value={settings.phase}       min={0}    max={360} step={1}    unit="°"  onChange={v => set('phase', v)} />
        <Slider label="THICKNESS"   value={settings.thickness}   min={1}    max={6}   step={0.5}  unit="px" onChange={v => set('thickness', v)} />
        <Slider label="PERSISTENCE" value={settings.persistence} min={0.01} max={0.3} step={0.01} unit=""   onChange={v => set('persistence', v)} />
        <Slider label="SPIN"        value={settings.spin}        min={0}    max={2}   step={0.1}  unit=""   onChange={v => set('spin', v)} />
        <Slider label="BEAT KICK"   value={settings.beatKick}    min={0}    max={180} step={5}    unit="°"  onChange={v => set('beatKick', v)} />
      </div>

      <div style={{ marginTop: 10, borderTop: `1px solid ${colors.panelBorder}`, paddingTop: 10 }}>
        <span style={{
          color: colors.secondary,
          fontSize: 10,
          fontFamily: fonts.mono,
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
