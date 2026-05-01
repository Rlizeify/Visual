import { spotifyPlayer } from '../../audio/SpotifyPlayer'
import WaveformSlider from './WaveformSlider'

function fmt(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

interface AudioControls {
  isPlaying: boolean
  play: () => void
  pause: () => void
  stop: () => void
  currentTime: number
  duration: number
}

interface PersistenceStatus {
  statusText: string
  projectName: string
}

interface Props {
  audio: AudioControls
  activeSource: 'mp3' | 'spotify'
  analyser: AnalyserNode | null
  volume: number
  onVolumeChange: (v: number) => void
  onLoad: () => void
  onHelp: () => void
  persistence: PersistenceStatus
}

export default function CockpitBottomBar({
  audio, activeSource, analyser, volume, onVolumeChange, onLoad, onHelp, persistence,
}: Props) {
  const isSpotify = activeSource === 'spotify'

  const handlePlay  = () => isSpotify ? void spotifyPlayer.play()        : audio.play()
  const handlePause = () => isSpotify ? void spotifyPlayer.pause()       : audio.pause()
  const handleStop  = () => isSpotify ? void spotifyPlayer.pause()       : audio.stop()

  return (
    <div className="cockpit-bottom-bar" data-tutorial-id="cockpit-bottom-bar">
      <button className="cockpit-btn" onClick={onLoad}>LOAD FILE</button>
      <button className={`cockpit-btn${audio.isPlaying ? ' active' : ''}`} onClick={handlePlay}>PLAY</button>
      <button className="cockpit-btn" onClick={handlePause}>PAUSE</button>
      <button className="cockpit-btn" onClick={handleStop}>STOP</button>
      <span className="cockpit-source-indicator">SOURCE: {isSpotify ? 'SPOTIFY' : 'MP3'}</span>
      <span className="cockpit-time">{fmt(audio.currentTime)}</span>
      <span className="cockpit-time cockpit-time--dim">{audio.duration > 0 ? fmt(audio.duration) : '--:--'}</span>
      <span className={`project-status ${persistence.projectName !== 'Untitled' ? 'project-status--saved' : 'project-status--unsaved'}`}>
        {persistence.statusText}
      </span>
      <span className="cockpit-vol-label">MAIN VOLUME</span>
      <WaveformSlider analyser={analyser} volume={volume} onVolumeChange={onVolumeChange} />
      <button className="cockpit-help-btn" onClick={onHelp} aria-label="Open tutorial">?</button>
    </div>
  )
}
