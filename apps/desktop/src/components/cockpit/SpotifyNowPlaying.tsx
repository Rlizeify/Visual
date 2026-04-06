/** Now-playing strip shown when the Spotify player is active. */
import type { SpotifyTrack } from '../../audio/SpotifyPlayerTypes'

interface Props {
  track: SpotifyTrack
  isPlaying: boolean
  onPrev: () => void
  onToggle: () => void
  onNext: () => void
}

export default function SpotifyNowPlaying({ track, isPlaying, onPrev, onToggle, onNext }: Props) {
  return (
    <div className="sp-now-playing">
      {track.albumArt && (
        <img className="sp-now-playing__art" src={track.albumArt} alt="" />
      )}
      <div className="sp-now-playing__info">
        <span className="sp-now-playing__name">{track.name}</span>
        <span className="sp-now-playing__artist">{track.artist}</span>
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
