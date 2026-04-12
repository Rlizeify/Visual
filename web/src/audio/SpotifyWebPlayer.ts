// Spotify Web API polling + OAuth PKCE integration

const CLIENT_ID = '1da72125c08248d99fc0677d415f4e36'
const REDIRECT_URI = window.location.hostname === 'localhost'
  ? 'http://localhost:5173/callback'
  : 'https://project-iwmob.vercel.app/callback'
const SCOPES = [
  'user-read-email',
  'user-read-private',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join(' ')

// PKCE helpers
function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const values = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(values).map(x => possible[x % possible.length]).join('')
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const data = encoder.encode(plain)
  return crypto.subtle.digest('SHA-256', data)
}

function base64urlencode(a: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(a)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// OAuth PKCE flow
export async function initiateSpotifyLogin(): Promise<void> {
  const codeVerifier = generateRandomString(64)
  const hashed = await sha256(codeVerifier)
  const codeChallenge = base64urlencode(hashed)

  sessionStorage.setItem('code_verifier', codeVerifier)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  })

  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`
}

export async function handleCallback(): Promise<string | null> {
  const urlParams = new URLSearchParams(window.location.search)
  const code = urlParams.get('code')
  const codeVerifier = sessionStorage.getItem('code_verifier')

  if (!code || !codeVerifier) return null

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
    }),
  })

  const data = await response.json()
  if (data.access_token) {
    localStorage.setItem('spotify_access_token', data.access_token)
    localStorage.setItem('spotify_refresh_token', data.refresh_token)
    localStorage.setItem('spotify_token_expiry', String(Date.now() + data.expires_in * 1000))
    sessionStorage.removeItem('code_verifier')
    return data.access_token
  }
  return null
}

export function getAccessToken(): string | null {
  return localStorage.getItem('spotify_access_token')
}

export function isAuthenticated(): boolean {
  const token = getAccessToken()
  const expiry = localStorage.getItem('spotify_token_expiry')
  if (!token || !expiry) return false
  return Date.now() < parseInt(expiry)
}

export async function refreshToken(): Promise<string | null> {
  const storedRefresh = localStorage.getItem('spotify_refresh_token')
  if (!storedRefresh) return null

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: storedRefresh,
    }),
  })

  const data = await response.json()
  if (data.access_token) {
    localStorage.setItem('spotify_access_token', data.access_token)
    localStorage.setItem('spotify_token_expiry', String(Date.now() + data.expires_in * 1000))
    if (data.refresh_token) {
      localStorage.setItem('spotify_refresh_token', data.refresh_token)
    }
    return data.access_token
  }
  return null
}

// User profile
export async function fetchUserProfile(): Promise<{ display_name: string; email: string } | null> {
  const token = getAccessToken()
  if (!token) return null

  const response = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (response.ok) return response.json()
  return null
}

// Music data state
export interface MusicData {
  isPlaying: boolean
  trackId: string | null
  trackName: string
  artistName: string
  albumArt: string
  progress: number  // ms
  duration: number  // ms
  energy: number    // 0-1
  danceability: number // 0-1
  tempo: number     // BPM
  valence: number   // 0-1
  shuffleState: boolean
}

const defaultMusicData: MusicData = {
  isPlaying: false,
  trackId: null,
  trackName: '',
  artistName: '',
  albumArt: '',
  progress: 0,
  duration: 0,
  energy: 0.5,
  danceability: 0.5,
  tempo: 120,
  valence: 0.5,
  shuffleState: false,
}

let currentMusicData: MusicData = { ...defaultMusicData }
let pollTimeout: ReturnType<typeof setTimeout> | null = null

// Expose music data on window for debugging
declare global {
  interface Window {
    __musicData?: {
      isPlaying: boolean
      trackName: string
      energy: number
      tempo: number
      danceability: number
    }
  }
}

function updateWindowMusicData(): void {
  window.__musicData = {
    isPlaying: currentMusicData.isPlaying,
    trackName: currentMusicData.trackName,
    energy: currentMusicData.energy,
    tempo: currentMusicData.tempo,
    danceability: currentMusicData.danceability,
  }
}

export function getMusicData(): MusicData {
  return currentMusicData
}

async function fetchAudioFeatures(trackId: string): Promise<void> {
  const token = getAccessToken()
  if (!token) return

  const response = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (response.ok) {
    const data = await response.json()
    currentMusicData = {
      ...currentMusicData,
      energy: data.energy ?? 0.5,
      danceability: data.danceability ?? 0.5,
      tempo: data.tempo ?? 120,
      valence: data.valence ?? 0.5,
    }
    console.log('[SpotifyWebPlayer] Audio features fetched:', {
      trackName: currentMusicData.trackName,
      energy: currentMusicData.energy,
      tempo: currentMusicData.tempo,
      danceability: currentMusicData.danceability,
    })
  }
}

async function pollPlaybackState(): Promise<void> {
  const token = getAccessToken()
  if (!token) {
    console.log('[SpotifyWebPlayer] Poll: No token, waiting...')
    schedulePoll(3000)
    return
  }

  try {
    const response = await fetch('https://api.spotify.com/v1/me/player', {
      headers: { Authorization: `Bearer ${token}` },
    })

    console.log('[SpotifyWebPlayer] Poll: HTTP', response.status)

    if (response.status === 204) {
      // No active device
      console.log('[SpotifyWebPlayer] Poll: No active device (204)')
      currentMusicData = { ...currentMusicData, isPlaying: false }
      updateWindowMusicData()
      schedulePoll(3000)
      return
    }

    if (response.ok) {
      const data = await response.json()
      const trackId = data.item?.id ?? null
      const prevTrackId = currentMusicData.trackId

      currentMusicData = {
        ...currentMusicData,
        isPlaying: data.is_playing ?? false,
        trackId,
        trackName: data.item?.name ?? '',
        artistName: data.item?.artists?.[0]?.name ?? '',
        albumArt: data.item?.album?.images?.[0]?.url ?? '',
        progress: data.progress_ms ?? 0,
        duration: data.item?.duration_ms ?? 0,
        shuffleState: data.shuffle_state ?? false,
      }

      console.log('[SpotifyWebPlayer] Poll: Track found:', currentMusicData.trackName || '(none)', '| Playing:', currentMusicData.isPlaying)

      // Fetch audio features when track changes
      if (trackId && trackId !== prevTrackId) {
        fetchAudioFeatures(trackId)
      }

      updateWindowMusicData()
    }
  } catch (err) {
    console.error('[SpotifyWebPlayer] Poll: Network error', err)
  }

  schedulePoll(currentMusicData.isPlaying ? 1000 : 3000)
}

function schedulePoll(delay: number): void {
  if (pollTimeout !== null) {
    clearTimeout(pollTimeout)
  }
  pollTimeout = setTimeout(pollPlaybackState, delay)
}

export function startPolling(): void {
  pollPlaybackState()
}

export function stopPolling(): void {
  if (pollTimeout !== null) {
    clearTimeout(pollTimeout)
    pollTimeout = null
  }
}

// Playback controls via Web API
export async function play(): Promise<void> {
  const token = getAccessToken()
  if (!token) return
  await fetch('https://api.spotify.com/v1/me/player/play', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function pause(): Promise<void> {
  const token = getAccessToken()
  if (!token) return
  await fetch('https://api.spotify.com/v1/me/player/pause', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function nextTrack(): Promise<void> {
  const token = getAccessToken()
  if (!token) return
  await fetch('https://api.spotify.com/v1/me/player/next', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function previousTrack(): Promise<void> {
  const token = getAccessToken()
  if (!token) return
  await fetch('https://api.spotify.com/v1/me/player/previous', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function toggleShuffle(state: boolean): Promise<void> {
  const token = getAccessToken()
  if (!token) return
  await fetch(`https://api.spotify.com/v1/me/player/shuffle?state=${state}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  })
}
