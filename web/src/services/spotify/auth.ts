import { clearAuth } from './tokens'
import { setTokens } from './tokenStore'

export const CLIENT_ID = '1da72125c08248d99fc0677d415f4e36'
// Derive at call time from window.location.origin so the same code works
// across localhost, mheu.lol, and any preview domain. Spotify app dashboard
// must whitelist every origin's /callback path that may initiate auth.
function getRedirectUri(): string {
  return `${window.location.origin}/callback`
}
const SCOPES = [
  'user-read-email',
  'user-read-private',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  // Required for /v1/me/player/recently-played, the scoring ingestion
  // endpoint. Users linked before this scope was added will get 403
  // until they disconnect + reconnect Spotify. See
  // `.claude/memory/progress/scores-broken-audit.md`.
  'user-read-recently-played',
].join(' ')

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

export async function buildAuthUrl(): Promise<string> {
  const codeVerifier = generateRandomString(64)
  const hashed = await sha256(codeVerifier)
  const codeChallenge = base64urlencode(hashed)
  const state = generateRandomString(32)

  sessionStorage.setItem('code_verifier', codeVerifier)
  sessionStorage.setItem('spotify_oauth_state', state)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    state,
  })

  return `https://accounts.spotify.com/authorize?${params.toString()}`
}

export async function initiateSpotifyLogin(): Promise<void> {
  window.location.href = await buildAuthUrl()
}

export async function handleCallback(): Promise<string | null> {
  const urlParams = new URLSearchParams(window.location.search)
  const code = urlParams.get('code')
  const returnedState = urlParams.get('state')
  const codeVerifier = sessionStorage.getItem('code_verifier')
  const expectedState = sessionStorage.getItem('spotify_oauth_state')

  // TV browsers can clear sessionStorage between redirect and callback — restart clean
  if (!code || !codeVerifier) {
    clearAuth()
    return null
  }

  // CSRF guard: the state we issued must match what Spotify returned.
  // If we issued a state (expectedState present) and it doesn't match, reject.
  // Tokens linked before this change won't have expectedState set; tolerate
  // the missing-state case to avoid breaking in-flight logins on the rollout.
  if (expectedState && returnedState !== expectedState) {
    sessionStorage.removeItem('spotify_oauth_state')
    clearAuth()
    return null
  }
  sessionStorage.removeItem('spotify_oauth_state')

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
      code_verifier: codeVerifier,
    }),
  })

  const data = await response.json()
  if (data.access_token && data.refresh_token && typeof data.expires_in === 'number') {
    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()
    await setTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: expiresAt,
      scope: typeof data.scope === 'string' ? data.scope : null,
    })
    sessionStorage.removeItem('code_verifier')
    return data.access_token
  }
  return null
}
