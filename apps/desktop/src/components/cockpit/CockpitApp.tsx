import TopBar from './TopBar'
import LeftPanel from './LeftPanel'
import CenterPanel from './CenterPanel'
import RightPanel from './RightPanel'
import BottomBar from './BottomBar'
import { useAudioEngine } from '../../hooks/useAudioEngine'

export default function CockpitApp() {
  const audio = useAudioEngine()

  const handleLoad = async () => {
    const filepath = await window.api?.loadMp3()
    if (filepath) await audio.load(filepath)
  }

  return (
    <div className="cockpit-frame">
      <TopBar trackName={audio.filename || ''} />

      <div className="cockpit-body">
        <LeftPanel bass={audio.bass} mid={audio.mid} high={audio.high} />
        <CenterPanel
          isPlaying={audio.isPlaying}
          isLoaded={audio.isLoaded}
          currentTime={audio.currentTime}
          duration={audio.duration}
          onLoad={handleLoad}
          onPlay={audio.play}
          onPause={audio.pause}
          onStop={audio.stop}
          onSeek={audio.seek}
        />
        <RightPanel
          onSpeedChange={audio.setSpeed}
          onWeightChange={audio.setWeight}
          onTextureChange={audio.setTexture}
          onBrightnessChange={audio.setBrightness}
          onBassBoostChange={audio.setBassBoost}
        />
      </div>

      <BottomBar fileName={audio.filename || ''} duration={audio.duration} />
    </div>
  )
}
