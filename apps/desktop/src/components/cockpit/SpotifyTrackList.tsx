/** Expandable track list for a single playlist row. */
import type { SpotifyTrack } from '../../audio/SpotifyPlayerTypes'

function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

interface Props {
  tracks: SpotifyTrack[]
  loading: boolean
  currentUri: string | null
  isReady: boolean
  onPlay: (uri: string) => void
}

export default function SpotifyTrackList({ tracks, loading, currentUri, isReady, onPlay }: Props) {
  return (
    <div className="sp-tracks">
      {loading ? (
        <div className="sp-tracks__loading">Loading...</div>
      ) : (
        tracks.map((t, i) => (
          <div
            key={t.uri}
            className={[
              'sp-track',
              currentUri === t.uri ? 'sp-track--active' : '',
              !isReady ? 'sp-track--disabled' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => isReady && onPlay(t.uri)}
          >
            <span className="sp-track__num">{i + 1}</span>
            <div className="sp-track__info">
              <span className="sp-track__name">{t.name}</span>
              <span className="sp-track__artist">{t.artist}</span>
            </div>
            <span className="sp-track__dur">{fmtMs(t.duration)}</span>
          </div>
        ))
      )}
    </div>
  )
}
