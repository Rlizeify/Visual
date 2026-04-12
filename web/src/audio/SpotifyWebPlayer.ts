// Spotify Web Playback SDK and OAuth PKCE integration

const CLIENT_ID = '1da72125c08248d99fc0677d415f4e36'
const REDIRECT_URI = import.meta.env.PROD
  ? 'https://project-8dt8p.vercel.app/callback'
  : 'http://localhost:5173/callback'
const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing'
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
  const refreshToken = localStorage.getItem('spotify_refresh_token')
  if (!refreshToken) return null

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
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

// Spotify Web API calls
export async function fetchUserProfile(): Promise<{ display_name: string; email: string } | null> {
  const token = getAccessToken()
  if (!token) return null

  const response = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (response.ok) {
    return response.json()
  }
  return null
}

export async function getPlaybackState(): Promise<SpotifyPlaybackState | null> {
  const token = getAccessToken()
  if (!token) return null

  const response = await fetch('https://api.spotify.com/v1/me/player', {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (response.status === 204) return null
  if (response.ok) return response.json()
  return null
}

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

export async function transferPlayback(deviceId: string): Promise<void> {
  const token = getAccessToken()
  if (!token) return

  await fetch('https://api.spotify.com/v1/me/player', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ device_ids: [deviceId], play: true }),
  })
}

// Types
export interface SpotifyPlaybackState {
  is_playing: boolean
  shuffle_state: boolean
  item?: {
    name: string
    artists: { name: string }[]
    album: { name: string; images: { url: string }[] }
  }
  device?: {
    id: string
    name: string
  }
}

// Spotify Web Playback SDK types
declare global {
  interface Window {
    Spotify: typeof Spotify
    onSpotifyWebPlaybackSDKReady: () => void
  }

  namespace Spotify {
    class Player {
      constructor(options: {
        name: string
        getOAuthToken: (cb: (token: string) => void) => void
        volume?: number
      })
      connect(): Promise<boolean>
      disconnect(): void
      addListener(event: string, callback: (state: unknown) => void): void
      removeListener(event: string, callback?: (state: unknown) => void): void
      getCurrentState(): Promise<unknown>
      setName(name: string): Promise<void>
      getVolume(): Promise<number>
      setVolume(volume: number): Promise<void>
      pause(): Promise<void>
      resume(): Promise<void>
      togglePlay(): Promise<void>
      seek(position_ms: number): Promise<void>
      previousTrack(): Promise<void>
      nextTrack(): Promise<void>
    }
  }
}

let player: Spotify.Player | null = null
let deviceId: string | null = null

export function initializePlayer(onReady: (id: string) => void, onStateChange: (state: unknown) => void): void {
  window.onSpotifyWebPlaybackSDKReady = () => {
    const token = getAccessToken()
    if (!token) return

    player = new window.Spotify.Player({
      name: 'MHEU Visualizer',
      getOAuthToken: cb => { cb(token) },
      volume: 0.5,
    })

    player.addListener('ready', ({ device_id }: { device_id: string }) => {
      deviceId = device_id
      onReady(device_id)
    })

    player.addListener('player_state_changed', onStateChange)

    player.addListener('not_ready', ({ device_id }: { device_id: string }) => {
      console.log('Device has gone offline:', device_id)
    })

    player.addListener('initialization_error', ({ message }: { message: string }) => {
      console.error('Initialization error:', message)
    })

    player.addListener('authentication_error', ({ message }: { message: string }) => {
      console.error('Authentication error:', message)
    })

    player.addListener('account_error', ({ message }: { message: string }) => {
      console.error('Account error:', message)
    })

    player.connect()
  }

  // If SDK already loaded, trigger manually
  if (window.Spotify) {
    window.onSpotifyWebPlaybackSDKReady()
  }
}

export function getDeviceId(): string | null {
  return deviceId
}

export function getPlayer(): Spotify.Player | null {
  return player
}
