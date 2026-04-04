import Dial from './Dial'
import ToggleSwitch from './ToggleSwitch'

interface RightPanelProps {
  onSpeedChange: (value: number) => void
  onWeightChange: (value: number) => void
  onTextureChange: (value: number) => void
  onBrightnessChange: (value: number) => void
  onBassBoostChange: (enabled: boolean) => void
  onBeatSyncChange: (enabled: boolean) => void
  onVinylSimChange: (enabled: boolean) => void
  onStereoWideChange: (enabled: boolean) => void
  onNightModeChange: (enabled: boolean) => void
  onPushDisplayChange: (enabled: boolean) => void
}

export default function RightPanel({
  onSpeedChange,
  onWeightChange,
  onTextureChange,
  onBrightnessChange,
  onBassBoostChange,
  onBeatSyncChange,
  onVinylSimChange,
  onStereoWideChange,
  onNightModeChange,
  onPushDisplayChange,
}: RightPanelProps) {
  return (
    <div className="right-panel">
      {/* Dials */}
      <div className="panel dials-section">
        <span className="panel-label">INSTRUMENTS</span>
        <div className="dials-grid">
          <Dial name="SPEED"      min={25}  max={200} defaultValue={100} unit="%" onChange={onSpeedChange} />
          <Dial name="WEIGHT"     min={0}   max={100} defaultValue={50}  unit=""  onChange={onWeightChange} />
          <Dial name="TEXTURE"    min={0}   max={100} defaultValue={20}  unit=""  onChange={onTextureChange} />
          <Dial name="BRIGHTNESS" min={0}   max={100} defaultValue={60}  unit=""  onChange={onBrightnessChange} />
        </div>
      </div>

      {/* Toggle switches */}
      <div className="panel toggles-section">
        <div className="toggles-row">
          <ToggleSwitch label="BEAT SYNC"   onChange={onBeatSyncChange} />
          <ToggleSwitch label="VINYL SIM"   onChange={onVinylSimChange} />
          <ToggleSwitch label="STEREO WIDE" onChange={onStereoWideChange} />
        </div>
        <div className="toggles-row">
          <ToggleSwitch label="BASS BOOST"  onChange={onBassBoostChange} />
          <ToggleSwitch label="NIGHT MODE"  defaultOn onChange={onNightModeChange} />
          <ToggleSwitch label="PUSH DISP"   onChange={onPushDisplayChange} />
        </div>
        <div className="toggles-row" style={{ marginTop: 8, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
          <button
            className="cockpit-btn"
            style={{
              fontSize: '10px',
              padding: '3px 5px',
              letterSpacing: '0.05em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
              boxSizing: 'border-box',
            }}
            onClick={() => (window as any).api?.toggleDisplayFullscreen?.()}
          >
            FULLSCREEN
          </button>
        </div>
      </div>
    </div>
  )
}
