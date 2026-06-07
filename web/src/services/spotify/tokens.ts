// Thin adapter over tokenStore. Preserves the existing import surface
// (`getAccessToken`, `isAuthenticated`, `hasRefreshToken`, `refreshToken`,
// `clearAuth`) so call sites in player.ts / polling.ts / session.ts /
// App.tsx don't need to change.

import { CLIENT_ID } from './auth'
import {
  clearLocal,
  disconnect,
  getAccessToken as memGetAccessToken,
  getExpiresAtMs,
  getRefreshToken,
  notifyRefreshInvalid,
  updateAccess,
} from './tokenStore'

// Trigger a proactive refresh when the access token has less than this
// many ms of life left. Spotify access tokens are 1h; 60s of slack is
// enough to absorb network latency and clock drift without burning
// refreshes on every call.
const REFRESH_SKEW_MS = 60_000

export function getAccessToken(): string | null {
  return memGetAccessToken()
}

export function isAuthenticated(): boolean {
  const token = memGetAccessToken()
  const expiresAt = getExpiresAtMs()
  if (!token || expiresAt == null) return false
  return Date.now() < expiresAt
}

export function hasRefreshToken(): boolean {
  return !!getRefreshToken()
}

// Dedup concurrent refreshes — polling, player actions, and seek can
// all hit the same expiry window at once. Without this, we'd race
// multiple refresh requests and the second one might find the
// refresh_token already rotated.
let inFlightRefresh: Promise<string | null> | null = null

export async function refreshToken(): Promise<string | null> {
  if (inFlightRefresh) return inFlightRefresh
  inFlightRefresh = (async () => {
    const stored = getRefreshToken()
    if (!stored) return null

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: stored,
      }),
    })

    if (!response.ok) {
      // 400 invalid_grant / 401 = refresh_token revoked (user changed
      // Spotify password, revoked access, etc.). Tear down the link.
      if (response.status === 400 || response.status === 401) {
        notifyRefreshInvalid()
      }
      return null
    }

    const data = await response.json()
    if (!data.access_token || typeof data.expires_in !== 'number') return null

    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()
    updateAccess(data.access_token, expiresAt, data.refresh_token)
    return data.access_token as string
  })().finally(() => { inFlightRefresh = null })
  return inFlightRefresh
}

/**
 * Returns a usable access token, refreshing proactively if expiry is
 * within REFRESH_SKEW_MS. Returns null if there's no token at all or
 * if the refresh fails terminally (notifyRefreshInvalid will already
 * have fired in the latter case).
 */
export async function getValidAccessToken(): Promise<string | null> {
  const token = memGetAccessToken()
  const expiresAt = getExpiresAtMs()
  if (!token) return null
  if (expiresAt != null && expiresAt - Date.now() > REFRESH_SKEW_MS) {
    return token
  }
  return refreshToken()
}

/**
 * Sign-out cleanup. Clears in-memory tokens only — the Supabase row
 * persists so the user is still Spotify-linked when they sign back in.
 * To fully unlink, call `disconnectSpotify()`.
 */
export function clearAuth(): void {
  clearLocal()
}

/** Full Spotify unlink — deletes Supabase row + clears in-memory state. */
export const disconnectSpotify = disconnect
