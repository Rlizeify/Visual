/** Now-playing strip shown when Spotify has an active track. */
import type { SpotifyTrack } from '../../audio/SpotifyPlayerTypes'

interface Props {
  track: SpotifyTrack
  isPlaying: boolean
  position: number
  duration: number
  onPrev: () => void
  onToggle: () => void
  onNext: () => void
}

export default function SpotifyNowPlaying({ track, isPlaying, position, duration, onPrev, onToggle, onNext }: Props) {
  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0

  return (
    <div className="sp-now-playing">
      {track.albumArt && (
        <img className="sp-now-playing__art" src={track.albumArt} alt="" />
      )}
      <div className="sp-now-playing__info">
        <span className="sp-now-playing__name">{track.name}</span>
        <span className="sp-now-playing__artist">{track.artist}</span>
        <div className="sp-progress">
          <div className="sp-progress__bar" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="sp-controls">
        <button className="sp-ctrl-btn" onClick={onPrev}>⏮</button>
        <button className="sp-ctrl-btn sp-ctrl-btn--play" onClick={onToggle}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button className="sp-ctrl-btn" onClick={onNext}>⏭</button>
      </div>
    </div>
  )
}
