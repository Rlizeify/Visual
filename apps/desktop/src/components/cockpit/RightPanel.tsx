import Dial from './Dial'
import ToggleSwitch from './ToggleSwitch'

interface RightPanelProps {
  onSpeedChange: (value: number) => void
  onWeightChange: (value: number) => void
  onTextureChange: (value: number) => void
  onBrightnessChange: (value: number) => void
  onBassBoostChange: (enabled: boolean) => void
}

export default function RightPanel({
  onSpeedChange,
  onWeightChange,
  onTextureChange,
  onBrightnessChange,
  onBassBoostChange,
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
          <ToggleSwitch label="BEAT SYNC"   />
          <ToggleSwitch label="VINYL SIM"   />
          <ToggleSwitch label="STEREO WIDE" />
        </div>
        <div className="toggles-row">
          <ToggleSwitch label="BASS BOOST"  onChange={onBassBoostChange} />
          <ToggleSwitch label="NIGHT MODE"  defaultOn />
          <ToggleSwitch label="PUSH DISP"   />
        </div>
      </div>
    </div>
  )
}
