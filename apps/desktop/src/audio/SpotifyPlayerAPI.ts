/** Spotify Web API helpers — playlist browsing and track fetching. */
import type { SpotifyPlaylist, SpotifyTrack } from './SpotifyPlayerTypes'

async function getToken(): Promise<string | null> {
  return (window as any).api?.spotifyGetAccessToken() ?? null
}

export async function fetchPlaylists(): Promise<SpotifyPlaylist[]> {
  const token = await getToken()
  if (!token) return []

  const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return []

  const data = await res.json()
  return (data.items ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    imageUrl: p.images?.[0]?.url ?? '',
    // tracks.total is the track count on the simplified playlist object
    trackCount: (p.tracks?.total as number) ?? 0,
  }))
}

export async function fetchPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
  const token = await getToken()
  if (!token) return []

  const res = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) return []

  const data = await res.json()
  return (data.items ?? [])
    .filter((item: any) => item?.track)
    .map((item: any) => ({
      uri: item.track.uri,
      name: item.track.name,
      artist: (item.track.artists as any[])?.map((a) => a.name).join(' / ') ?? 'Unknown',
      album: item.track.album?.name ?? '',
      albumArt: item.track.album?.images?.[0]?.url ?? '',
      duration: item.track.duration_ms as number,
    }))
}

