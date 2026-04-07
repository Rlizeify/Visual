/** Spotify Browser — Browse playlists, play tracks, show now-playing. */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { spotifyPlayer } from '../../audio/SpotifyPlayer'
import type { SpotifyPlaylist, SpotifyTrack, SpotifyPlayerState } from '../../audio/SpotifyPlayerTypes'
import type { SpotifyDevice } from '../../audio/SpotifyPlayerControls'
import SpotifyNowPlaying from './SpotifyNowPlaying'
import SpotifyTrackList from './SpotifyTrackList'

type SortMode = 'original' | 'alpha'

export default function SpotifyBrowser() {
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tracks, setTracks] = useState<SpotifyTrack[]>([])
  const [loadingTracks, setLoadingTracks] = useState(false)
  const [playerState, setPlayerState] = useState<SpotifyPlayerState>(spotifyPlayer.getState())
  const [sortMode, setSortMode] = useState<SortMode>('original')
  const [devices, setDevices] = useState<SpotifyDevice[]>([])

  useEffect(() => spotifyPlayer.subscribe(setPlayerState), [])

  useEffect(() => {
    if (!playerState.isConnected) return
    spotifyPlayer.fetchPlaylists().then(setPlaylists)
    spotifyPlayer.getDevices().then(setDevices)
  }, [playerState.isConnected])

  const sortedPlaylists = useMemo(
    () => sortMode === 'alpha'
      ? [...playlists].sort((a, b) => a.name.localeCompare(b.name))
      : playlists,
    [playlists, sortMode],
  )

  const handleExpandPlaylist = useCallback(async (id: string) => {
    if (expandedId === id) { setExpandedId(null); setTracks([]); return }
    setExpandedId(id)
    setLoadingTracks(true)
    setTracks(await spotifyPlayer.fetchPlaylistTracks(id))
    setLoadingTracks(false)
  }, [expandedId])

  const handlePlayTrack = useCallback((uri: string) => { void spotifyPlayer.play(uri) }, [])
  const handlePlayPlaylist = useCallback((id: string) => { void spotifyPlayer.play(`spotify:playlist:${id}`) }, [])

  if (!playerState.isConnected) {
    return (
      <div className="sp-root">
        <div className="sp-toolbar"><span className="sp-title">SPOTIFY</span></div>
        <div className="sp-empty"><span className="sp-empty__text">Not connected</span></div>
      </div>
    )
  }

  const activeDevice = devices.find((d) => d.is_active)

  return (
    <div className="sp-root">
      <div className="sp-toolbar">
        <span className="sp-title">SPOTIFY</span>
        <button
          className="sp-sort-btn"
          onClick={() => setSortMode(m => m === 'original' ? 'alpha' : 'original')}
          title="Toggle sort order"
        >
          {sortMode === 'original' ? 'A→Z' : 'ORIG'}
        </button>
        <button
          className="sp-refresh-btn"
          onClick={() => spotifyPlayer.fetchPlaylists().then(setPlaylists)}
          title="Refresh playlists"
        >↻</button>
      </div>

      {playerState.currentTrack && (
        <SpotifyNowPlaying
          track={playerState.currentTrack}
          isPlaying={playerState.isPlaying}
          position={playerState.position}
          duration={playerState.duration}
          onPrev={() => void spotifyPlayer.previousTrack()}
          onToggle={() => void spotifyPlayer.togglePlay()}
          onNext={() => void spotifyPlayer.nextTrack()}
        />
      )}

      {!activeDevice && devices.length > 0 && (
        <div className="sp-devices">
          <span className="sp-devices__label">Available devices:</span>
          {devices.map((d) => (
            <div key={d.id} className="sp-device">{d.name} <span className="sp-device__type">{d.type}</span></div>
          ))}
        </div>
      )}

      <div className="sp-list">
        {sortedPlaylists.length === 0 && (
          <div className="sp-empty"><span className="sp-empty__text">No playlists found</span></div>
        )}
        {sortedPlaylists.map((pl) => (
          <div key={pl.id}>
            <div
              className={`sp-playlist${expandedId === pl.id ? ' sp-playlist--active' : ''}`}
              onClick={() => void handleExpandPlaylist(pl.id)}
            >
              <div className="sp-playlist__info">
                <span className="sp-playlist__name">{pl.name}</span>
                <span className="sp-playlist__count">{pl.trackCount} tracks</span>
              </div>
              <button
                className="sp-playlist__play"
                onClick={(e) => { e.stopPropagation(); handlePlayPlaylist(pl.id) }}
                title="Play playlist"
              >▶</button>
            </div>

            {expandedId === pl.id && (
              <SpotifyTrackList
                tracks={tracks}
                loading={loadingTracks}
                currentUri={playerState.currentTrack?.uri ?? null}
                isReady={playerState.isReady}
                onPlay={handlePlayTrack}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
