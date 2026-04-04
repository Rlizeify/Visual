import Dial from './Dial'
import ToggleSwitch from './ToggleSwitch'
import { Tooltip } from '../shared'

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
          <Tooltip text="SPEED" detail="Hold left click then scroll to adjust playback rate">
            <Dial name="SPEED"      min={25}  max={200} defaultValue={100} unit="%" onChange={onSpeedChange} />
          </Tooltip>
          <Tooltip text="WEIGHT" detail="Hold left click then scroll to boost or cut bass">
            <Dial name="WEIGHT"     min={0}   max={100} defaultValue={50}  unit=""  onChange={onWeightChange} />
          </Tooltip>
          <Tooltip text="TEXTURE" detail="Hold left click then scroll to add reverb and space">
            <Dial name="TEXTURE"    min={0}   max={100} defaultValue={20}  unit=""  onChange={onTextureChange} />
          </Tooltip>
          <Tooltip text="BRIGHTNESS" detail="Hold left click then scroll to adjust treble">
            <Dial name="BRIGHTNESS" min={0}   max={100} defaultValue={60}  unit=""  onChange={onBrightnessChange} />
          </Tooltip>
        </div>
      </div>

      {/* Toggle switches */}
      <div className="panel toggles-section">
        <div className="toggles-row">
          <Tooltip text="BEAT SYNC" detail="Flashes UI elements in sync with detected beats">
            <ToggleSwitch label="BEAT SYNC"   onChange={onBeatSyncChange} />
          </Tooltip>
          <Tooltip text="VINYL SIM" detail="Adds subtle wow and flutter like a real vinyl record">
            <ToggleSwitch label="VINYL SIM"   onChange={onVinylSimChange} />
          </Tooltip>
          <Tooltip text="STEREO WIDE" detail="Widens the stereo field for a bigger sound">
            <ToggleSwitch label="STEREO WIDE" onChange={onStereoWideChange} />
          </Tooltip>
        </div>
        <div className="toggles-row">
          <Tooltip text="BASS BOOST" detail="Applies a +6db boost at 80hz for heavier bass">
            <ToggleSwitch label="BASS BOOST"  onChange={onBassBoostChange} />
          </Tooltip>
          <Tooltip text="NIGHT MODE" detail="Dims the interface for low-light environments">
            <ToggleSwitch label="NIGHT MODE"  defaultOn onChange={onNightModeChange} />
          </Tooltip>
          <Tooltip text="PUSH DISPLAY" detail="Opens and activates the visualizer output window">
            <ToggleSwitch label="PUSH DISP"   onChange={onPushDisplayChange} />
          </Tooltip>
        </div>
        <div className="toggles-row" style={{ marginTop: 8, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
          <Tooltip text="FULLSCREEN" detail="Toggle fullscreen on the visualizer display window">
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
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
