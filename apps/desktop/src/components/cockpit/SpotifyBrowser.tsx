/** Spotify Browser — Browse playlists, play tracks, show now-playing. */
import { useState, useEffect, useCallback } from 'react'
import { spotifyPlayer, SpotifyPlaylist, SpotifyTrack, SpotifyPlayerState } from '../../audio/SpotifyPlayer'

function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export default function SpotifyBrowser() {
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tracks, setTracks] = useState<SpotifyTrack[]>([])
  const [loadingTracks, setLoadingTracks] = useState(false)
  const [playerState, setPlayerState] = useState<SpotifyPlayerState>(spotifyPlayer.getState())

  useEffect(() => {
    return spotifyPlayer.subscribe(setPlayerState)
  }, [])

  // Load playlists when connected
  useEffect(() => {
    if (playerState.isReady) {
      spotifyPlayer.fetchPlaylists().then(setPlaylists)
    }
  }, [playerState.isReady])

  const handleExpandPlaylist = useCallback(async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      setTracks([])
      return
    }
    setExpandedId(id)
    setLoadingTracks(true)
    const t = await spotifyPlayer.fetchPlaylistTracks(id)
    setTracks(t)
    setLoadingTracks(false)
  }, [expandedId])

  const handlePlayTrack = useCallback((uri: string) => {
    spotifyPlayer.play(uri)
  }, [])

  const handlePlayPlaylist = useCallback((id: string) => {
    spotifyPlayer.play(`spotify:playlist:${id}`)
  }, [])

  if (!playerState.isReady) {
    return (
      <div className="sp-root">
        <div className="sp-toolbar">
          <span className="sp-title">SPOTIFY</span>
        </div>
        <div className="sp-empty">
          <span className="sp-empty__text">
            {playerState.isConnected ? 'Initializing player...' : 'Not connected'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="sp-root">
      <div className="sp-toolbar">
        <span className="sp-title">SPOTIFY</span>
        <button
          className="sp-refresh-btn"
          onClick={() => spotifyPlayer.fetchPlaylists().then(setPlaylists)}
          title="Refresh playlists"
        >
          ↻
        </button>
      </div>

      {/* Now Playing */}
      {playerState.currentTrack && (
        <div className="sp-now-playing">
          {playerState.currentTrack.albumArt && (
            <img
              className="sp-now-playing__art"
              src={playerState.currentTrack.albumArt}
              alt=""
            />
          )}
          <div className="sp-now-playing__info">
            <span className="sp-now-playing__name">{playerState.currentTrack.name}</span>
            <span className="sp-now-playing__artist">{playerState.currentTrack.artist}</span>
          </div>
          <div className="sp-controls">
            <button className="sp-ctrl-btn" onClick={() => spotifyPlayer.previousTrack()}>⏮</button>
            <button className="sp-ctrl-btn sp-ctrl-btn--play" onClick={() => spotifyPlayer.togglePlay()}>
              {playerState.isPlaying ? '⏸' : '▶'}
            </button>
            <button className="sp-ctrl-btn" onClick={() => spotifyPlayer.nextTrack()}>⏭</button>
          </div>
        </div>
      )}

      {/* Playlist list */}
      <div className="sp-list">
        {playlists.length === 0 && (
          <div className="sp-empty">
            <span className="sp-empty__text">No playlists found</span>
          </div>
        )}
        {playlists.map((pl) => (
          <div key={pl.id}>
            <div
              className={`sp-playlist${expandedId === pl.id ? ' sp-playlist--active' : ''}`}
              onClick={() => handleExpandPlaylist(pl.id)}
            >
              <div className="sp-playlist__info">
                <span className="sp-playlist__name">{pl.name}</span>
                <span className="sp-playlist__count">{pl.trackCount} tracks</span>
              </div>
              <button
                className="sp-playlist__play"
                onClick={(e) => { e.stopPropagation(); handlePlayPlaylist(pl.id) }}
                title="Play playlist"
              >
                ▶
              </button>
            </div>

            {/* Expanded tracks */}
            {expandedId === pl.id && (
              <div className="sp-tracks">
                {loadingTracks ? (
                  <div className="sp-tracks__loading">Loading...</div>
                ) : tracks.map((t, i) => (
                  <div
                    key={t.uri}
                    className={`sp-track${playerState.currentTrack?.uri === t.uri ? ' sp-track--active' : ''}`}
                    onClick={() => handlePlayTrack(t.uri)}
                  >
                    <span className="sp-track__num">{i + 1}</span>
                    <div className="sp-track__info">
                      <span className="sp-track__name">{t.name}</span>
                      <span className="sp-track__artist">{t.artist}</span>
                    </div>
                    <span className="sp-track__dur">{fmtMs(t.duration)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
