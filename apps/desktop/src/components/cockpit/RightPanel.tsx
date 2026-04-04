import Dial from './Dial'
import ToggleSwitch from './ToggleSwitch'

export default function RightPanel() {
  return (
    <div className="right-panel">
      {/* Dials */}
      <div className="panel dials-section">
        <span className="panel-label">INSTRUMENTS</span>
        <div className="dials-grid">
          <Dial name="SPEED"      min={25}  max={200} defaultValue={100} unit="%" />
          <Dial name="WEIGHT"     min={0}   max={100} defaultValue={50}  unit="" />
          <Dial name="TEXTURE"    min={0}   max={100} defaultValue={20}  unit="" />
          <Dial name="BRIGHTNESS" min={0}   max={100} defaultValue={60}  unit="" />
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
          <ToggleSwitch label="BASS BOOST"  />
          <ToggleSwitch label="NIGHT MODE"  defaultOn />
          <ToggleSwitch label="PUSH DISP"   />
        </div>
      </div>
    </div>
  )
}
