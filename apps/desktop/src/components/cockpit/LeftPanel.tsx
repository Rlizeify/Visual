import { Tooltip } from '../shared'

interface VUMeterProps {
  label: string
  value: number // 0–100
  colorClass: string
}

function VUMeter({ label, value, colorClass }: VUMeterProps) {
  return (
    <div className="vu-meter">
      <div className="vu-meter__track">
        <div
          className={`vu-meter__fill vu-meter__fill--${colorClass}`}
          style={{ height: `${value}%` }}
        />
      </div>
      <span className="vu-meter__label">{label}</span>
    </div>
  )
}

interface LeftPanelProps {
  bass: number // 0–1
  mid: number  // 0–1
  high: number // 0–1
}

export default function LeftPanel({ bass, mid, high }: LeftPanelProps) {
  return (
    <div className="left-panel">
      {/* FREQ SCOPE */}
      <Tooltip text="FREQ SCOPE" detail="Frequency spectrum visualizer reacting to audio">
        <div className="panel panel-section freq-scope-wrap" style={{ flex: '1' }}>
          <span className="panel-label">FREQ SCOPE</span>
          <div className="freq-scope">
            <div className="freq-scope__bg">
              {/* Concentric rings */}
              {[40, 70, 100, 130, 160].map((size) => (
                <div
                  key={size}
                  className="freq-scope__ring"
                  style={{ width: size, height: size }}
                />
              ))}
              {/* Sweep line */}
              <div className="freq-scope__sweep" />
              {/* Center dot */}
              <div className="freq-scope__center" />
            </div>
          </div>
        </div>
      </Tooltip>

      {/* VU METERS */}
      <div className="panel panel-section" style={{ flexShrink: 0 }}>
        <span className="panel-label">LEVELS</span>
        <div className="vu-meters">
          <Tooltip text="BASS LEVELS" detail="Real-time low frequency energy meter">
            <VUMeter label="BASS" value={bass * 100} colorClass="bass" />
          </Tooltip>
          <Tooltip text="MID LEVELS" detail="Real-time mid frequency energy meter">
            <VUMeter label="MID"  value={mid * 100}  colorClass="mid" />
          </Tooltip>
          <Tooltip text="HIGH LEVELS" detail="Real-time high frequency energy meter">
            <VUMeter label="HIGH" value={high * 100}  colorClass="high" />
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
