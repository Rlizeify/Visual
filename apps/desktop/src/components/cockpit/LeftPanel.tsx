interface VUMeterProps {
  label: string
  value: number   // 0–100
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

export default function LeftPanel() {
  return (
    <div className="left-panel">
      {/* FREQ SCOPE */}
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

      {/* VU METERS */}
      <div className="panel panel-section" style={{ flexShrink: 0 }}>
        <span className="panel-label">LEVELS</span>
        <div className="vu-meters">
          <VUMeter label="BASS" value={60} colorClass="bass" />
          <VUMeter label="MID"  value={40} colorClass="mid" />
          <VUMeter label="HIGH" value={70} colorClass="high" />
        </div>
      </div>
    </div>
  )
}
