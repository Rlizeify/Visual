/* spotify-auth.ts — Spotify OAuth 2.0 PKCE flow for Visual */

import { BrowserWindow } from 'electron'
import { createServer, IncomingMessage, ServerResponse } from 'http'
import { randomBytes, createHash } from 'crypto'
import { getSetting, setSetting, deleteSetting } from './database'

const REDIRECT_URI = 'http://localhost:8888/callback'
const SCOPES = 'streaming user-read-email user-read-private user-library-read playlist-read-private'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'

interface SpotifyTokens {
  access_token: string
  refresh_token: string
  expires_at: number // unix ms
}

// ─── PKCE helpers ────────────────────────────────────────────────────────────

function generateCodeVerifier(): string {
  return randomBytes(64).toString('base64url')
}

function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

// ─── Token persistence ───────────────────────────────────────────────────────
// NOTE: Tokens stored in plaintext in SQLite. For production, encrypt with
// a key derived from the machine ID or use OS credential storage.

function storeTokens(tokens: SpotifyTokens): void {
  setSetting('spotify_access_token', tokens.access_token)
  setSetting('spotify_refresh_token', tokens.refresh_token)
  setSetting('spotify_expires_at', String(tokens.expires_at))
}

function loadTokens(): SpotifyTokens | null {
  const access = getSetting('spotify_access_token')
  const refresh = getSetting('spotify_refresh_token')
  const expires = getSetting('spotify_expires_at')
  if (!access || !refresh || !expires) return null
  return { access_token: access, refresh_token: refresh, expires_at: Number(expires) }
}

function clearTokens(): void {
  deleteSetting('spotify_access_token')
  deleteSetting('spotify_refresh_token')
  deleteSetting('spotify_expires_at')
}

// ─── OAuth flow ──────────────────────────────────────────────────────────────

export async function startSpotifyAuth(): Promise<SpotifyTokens> {
  const clientId = getSetting('spotify_client_id')
  if (!clientId) throw new Error('No Spotify Client ID configured')

  const verifier = generateCodeVerifier()
  const challenge = generateCodeChallenge(verifier)

  return new Promise((resolve, reject) => {
    // Temporary HTTP server to catch the OAuth callback
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? '/', `http://localhost:8888`)
      if (url.pathname !== '/callback') {
        res.writeHead(404)
        res.end()
        return
      }

      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      if (error || !code) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<html><body style="background:#010103;color:#ff3a3a;font-family:monospace;padding:40px"><h2>Authorization Failed</h2><p>You can close this window.</p></body></html>')
        server.close()
        authWin?.close()
        reject(new Error(error ?? 'No authorization code received'))
        return
      }

      try {
        const tokens = await exchangeCode(clientId, code, verifier)
        storeTokens(tokens)

        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<html><body style="background:#010103;color:#27e0e1;font-family:monospace;padding:40px"><h2>Connected to Spotify!</h2><p>You can close this window.</p></body></html>')
        server.close()
        authWin?.close()
        resolve(tokens)
      } catch (err) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<html><body style="background:#010103;color:#ff3a3a;font-family:monospace;padding:40px"><h2>Token Exchange Failed</h2><p>You can close this window.</p></body></html>')
        server.close()
        authWin?.close()
        reject(err)
      }
    })

    server.listen(8888, () => {
      const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        scope: SCOPES,
        code_challenge_method: 'S256',
        code_challenge: challenge,
      })

      const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`

      authWin = new BrowserWindow({
        width: 500,
        height: 700,
        title: 'Spotify Login',
        backgroundColor: '#191414',
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      })
      authWin.setMenuBarVisibility(false)
      authWin.loadURL(authUrl)

      authWin.on('closed', () => {
        authWin = null
        server.close()
      })
    })

    server.on('error', (err) => {
      reject(new Error(`Failed to start auth server: ${err.message}`))
    })
  })
}

let authWin: BrowserWindow | null = null

// ─── Token exchange ──────────────────────────────────────────────────────────

async function exchangeCode(clientId: string, code: string, verifier: string): Promise<SpotifyTokens> {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  })

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token exchange failed: ${res.status} ${text}`)
  }

  const data = await res.json()
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  }
}

// ─── Token refresh ───────────────────────────────────────────────────────────

export async function refreshSpotifyToken(): Promise<SpotifyTokens> {
  const clientId = getSetting('spotify_client_id')
  const tokens = loadTokens()
  if (!clientId || !tokens?.refresh_token) throw new Error('No refresh token available')

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
  })

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token refresh failed: ${res.status} ${text}`)
  }

  const data = await res.json()
  const newTokens: SpotifyTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? tokens.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  }
  storeTokens(newTokens)
  return newTokens
}

// ─── Public getters ──────────────────────────────────────────────────────────

/** Get a valid access token, refreshing if expired. Returns null if not connected. */
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = loadTokens()
  if (!tokens) return null

  // Refresh if less than 60s remaining
  if (Date.now() > tokens.expires_at - 60_000) {
    try {
      const refreshed = await refreshSpotifyToken()
      return refreshed.access_token
    } catch {
      return null
    }
  }

  return tokens.access_token
}

export function isSpotifyConnected(): boolean {
  return loadTokens() !== null
}

export function disconnectSpotify(): void {
  clearTokens()
}

export function getSpotifyClientId(): string | null {
  return getSetting('spotify_client_id')
}

export function setSpotifyClientId(clientId: string): void {
  setSetting('spotify_client_id', clientId)
}
