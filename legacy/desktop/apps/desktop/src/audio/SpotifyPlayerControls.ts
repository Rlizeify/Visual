/** Spotify Web API — playback control commands (no SDK required). */

export interface SpotifyDevice {
  id: string
  name: string
  type: string
  is_active: boolean
  volume_percent: number
}

async function getToken(): Promise<string | null> {
  return (window as any).api?.spotifyGetAccessToken() ?? null
}

async function apiPut(path: string, body?: object): Promise<void> {
  const token = await getToken()
  if (!token) return
  await fetch(`https://api.spotify.com/v1/me/player${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

async function apiPost(path: string): Promise<void> {
  const token = await getToken()
  if (!token) return
  await fetch(`https://api.spotify.com/v1/me/player${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function playTrackUri(uri: string): Promise<void> {
  const body = uri.includes('playlist') ? { context_uri: uri } : { uris: [uri] }
  await apiPut('/play', body)
}

export async function pausePlayback(): Promise<void> { await apiPut('/pause') }
export async function resumePlayback(): Promise<void> { await apiPut('/play') }
export async function skipToNext(): Promise<void> { await apiPost('/next') }
export async function skipToPrevious(): Promise<void> { await apiPost('/previous') }

export async function getDevices(): Promise<SpotifyDevice[]> {
  const token = await getToken()
  if (!token) return []
  const res = await fetch('https://api.spotify.com/v1/me/player/devices', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.devices ?? []) as SpotifyDevice[]
}

export async function getNowPlaying(): Promise<any> {
  const token = await getToken()
  if (!token) return null
  const res = await fetch('https://api.spotify.com/v1/me/player', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok || res.status === 204) return null
  return res.json()
}
