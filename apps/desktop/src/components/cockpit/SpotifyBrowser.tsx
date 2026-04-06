/** Spotify Browser — Browse playlists, play tracks, show now-playing. */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { spotifyPlayer } from '../../audio/SpotifyPlayer'
import type { SpotifyPlaylist, SpotifyTrack, SpotifyPlayerState } from '../../audio/SpotifyPlayerTypes'
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

  useEffect(() => spotifyPlayer.subscribe(setPlayerState), [])

  useEffect(() => {
    if (playerState.isConnected) {
      spotifyPlayer.fetchPlaylists().then(setPlaylists)
    }
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

  const handlePlayTrack = useCallback((uri: string) => { spotifyPlayer.play(uri) }, [])
  const handlePlayPlaylist = useCallback((id: string) => { spotifyPlayer.play(`spotify:playlist:${id}`) }, [])

  if (!playerState.isConnected) {
    return (
      <div className="sp-root">
        <div className="sp-toolbar"><span className="sp-title">SPOTIFY</span></div>
        <div className="sp-empty"><span className="sp-empty__text">Not connected</span></div>
      </div>
    )
  }

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

      {!playerState.isReady && (
        <div className="sp-sdk-status">
          <span className="sp-sdk-status__text">Connecting player…</span>
          <span className="sp-sdk-status__hint">Playback requires Spotify Premium</span>
        </div>
      )}

      {playerState.isReady && playerState.currentTrack && (
        <SpotifyNowPlaying
          track={playerState.currentTrack}
          isPlaying={playerState.isPlaying}
          onPrev={() => spotifyPlayer.previousTrack()}
          onToggle={() => spotifyPlayer.togglePlay()}
          onNext={() => spotifyPlayer.nextTrack()}
        />
      )}

      <div className="sp-list">
        {sortedPlaylists.length === 0 && (
          <div className="sp-empty"><span className="sp-empty__text">No playlists found</span></div>
        )}
        {sortedPlaylists.map((pl) => (
          <div key={pl.id}>
            <div
              className={`sp-playlist${expandedId === pl.id ? ' sp-playlist--active' : ''}`}
              onClick={() => handleExpandPlaylist(pl.id)}
            >
              <div className="sp-playlist__info">
                <span className="sp-playlist__name">{pl.name}</span>
                <span className="sp-playlist__count">{pl.trackCount} tracks</span>
              </div>
              {playerState.isReady && (
                <button
                  className="sp-playlist__play"
                  onClick={(e) => { e.stopPropagation(); handlePlayPlaylist(pl.id) }}
                  title="Play playlist"
                >▶</button>
              )}
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
