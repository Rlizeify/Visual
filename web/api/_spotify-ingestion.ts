// Server-side Spotify ingestion helpers shared by /api/cron/recompute
// and /api/scores (?action=recompute, ?action=recompute-all).
//
// Underscore prefix = NOT counted toward Vercel function ceiling.
//
// Why this file exists: the daily cron previously called the scoring
// engine over Supabase tables but never fetched fresh Spotify data —
// so users who didn't open /u in a foreground tab never had their
// listening ingested. Server-side polling, keyed off spotify_tokens
// (per-user access + refresh tokens stored 2026-05-24), closes that
// gap. See `.claude/memory/progress/scores-broken-audit.md` for the
// full chain.

import type { SupabaseClient } from '@supabase/supabase-js'

// Match the client-side PKCE client_id (browser-exposed; safe to
// duplicate). Env override for parity with other surfaces.
const SPOTIFY_CLIENT_ID =
  process.env.SPOTIFY_CLIENT_ID ?? '1da72125c08248d99fc0677d415f4e36'

// Spotify allows ~180 rpm on recently-played per app. With one call
// per user we throttle to 150ms between calls (≈400 rpm), well under
// the bursty limit if user count stays modest. Bump if we see 429s.
const PER_USER_THROTTLE_MS = 150

// Refresh access_token early so we don't waste a call only to discover
// it expired mid-flight.
const REFRESH_SKEW_MS = 60_000

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

export interface StoredSpotifyTokens {
  user_id: string
  access_token: string
  refresh_token: string
  expires_at: string  // ISO timestamptz
  scope: string | null
}

export interface RefreshResult {
  ok: boolean
  access_token?: string
  expires_at?: string
  refresh_token?: string  // rotated, if Spotify sent a new one
  revoked?: boolean       // true → row should be deleted
  status?: number
  error?: string
}

export interface SyncResult {
  ok: boolean
  inserted: number
  status?: number
  error?: string
}

interface SpotifyTrackArtist { id?: string; name?: string }
interface SpotifyTrack {
  id?: string
  name?: string
  duration_ms?: number
  artists?: SpotifyTrackArtist[]
}
interface SpotifyContext { type?: string; uri?: string }
interface SpotifyPlayItem {
  track?: SpotifyTrack
  context?: SpotifyContext | null
  played_at?: string
}
interface SpotifyRecentlyPlayedResponse {
  items?: SpotifyPlayItem[]
}

// ---------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------

/**
 * Exchange a refresh_token for a fresh access_token (PKCE flow —
 * client_id only, no client_secret).
 *
 * Spotify returns:
 *   200 + new access_token (+ possibly a rotated refresh_token)
 *   400 invalid_grant     → revoked
 *   401                   → revoked
 *   429                   → rate-limited (callers should retry)
 *   5xx                   → transient
 */
export async function refreshSpotifyAccessToken(
  refreshToken: string,
): Promise<RefreshResult> {
  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    if (res.status === 400 || res.status === 401) {
      return { ok: false, revoked: true, status: res.status }
    }
    if (!res.ok) {
      return { ok: false, status: res.status, error: `spotify ${res.status}` }
    }

    const data = (await res.json()) as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
    }
    if (!data.access_token || typeof data.expires_in !== 'number') {
      return { ok: false, error: 'malformed token response' }
    }

    return {
      ok: true,
      access_token: data.access_token,
      refresh_token: data.refresh_token,  // may be undefined; preserve old
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

/**
 * Ensure the user has a non-expired access_token. Refreshes + persists
 * if needed. Returns the token to use (null on failure).
 *
 * If Spotify says the refresh_token is revoked, deletes the row.
 */
export async function ensureFreshAccessToken(
  supabase: SupabaseClient,
  tokens: StoredSpotifyTokens,
): Promise<{ access_token: string | null; revoked: boolean }> {
  const expiresAtMs = Date.parse(tokens.expires_at)
  if (Number.isFinite(expiresAtMs) && Date.now() < expiresAtMs - REFRESH_SKEW_MS) {
    return { access_token: tokens.access_token, revoked: false }
  }

  const refresh = await refreshSpotifyAccessToken(tokens.refresh_token)

  if (refresh.revoked) {
    await supabase.from('spotify_tokens').delete().eq('user_id', tokens.user_id)
    return { access_token: null, revoked: true }
  }
  if (!refresh.ok || !refresh.access_token || !refresh.expires_at) {
    return { access_token: null, revoked: false }
  }

  await supabase.from('spotify_tokens').upsert({
    user_id: tokens.user_id,
    access_token: refresh.access_token,
    refresh_token: refresh.refresh_token ?? tokens.refresh_token,
    expires_at: refresh.expires_at,
    scope: tokens.scope,
  }, { onConflict: 'user_id' })

  return { access_token: refresh.access_token, revoked: false }
}

// ---------------------------------------------------------------------
// Recently-played ingestion
// ---------------------------------------------------------------------

/**
 * Fetch /v1/me/player/recently-played and upsert into
 * spotify_play_history + user_listening_stats.
 *
 * Idempotent — duplicates collide on (user_id, track_id, played_at).
 * Daily aggregates use max(existing, new) so re-syncs never reduce
 * counts.
 *
 * Note: this endpoint requires the `user-read-recently-played` OAuth
 * scope. Users who linked Spotify before that scope was added to
 * `web/src/services/spotify/auth.ts:SCOPES` will hit 403 here; the
 * remedy is to disconnect and re-link Spotify.
 */
export async function syncRecentlyPlayed(
  supabase: SupabaseClient,
  userId: string,
  accessToken: string,
): Promise<SyncResult> {
  let res: Response
  try {
    res = await fetch(
      'https://api.spotify.com/v1/me/player/recently-played?limit=50',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
  } catch (err) {
    return { ok: false, inserted: 0, error: (err as Error).message }
  }

  if (!res.ok) {
    return { ok: false, inserted: 0, status: res.status, error: `spotify ${res.status}` }
  }

  const body = (await res.json()) as SpotifyRecentlyPlayedResponse
  const items = body.items ?? []
  if (items.length === 0) return { ok: true, inserted: 0 }

  const rows = items
    .filter(it => it.track && it.played_at)
    .map(it => {
      const playlistUri = it.context?.type === 'playlist' ? it.context?.uri : null
      const playlistId = playlistUri ? playlistUri.split(':').pop() ?? null : null
      return {
        user_id: userId,
        track_id: it.track!.id ?? null,
        track_name: it.track!.name ?? null,
        artist_id: it.track!.artists?.[0]?.id ?? null,
        artist_name: it.track!.artists?.[0]?.name ?? null,
        playlist_id: playlistId,
        duration_ms: it.track!.duration_ms ?? null,
        played_at: it.played_at!,
      }
    })

  const { error: insertErr } = await supabase
    .from('spotify_play_history')
    .upsert(rows, { onConflict: 'user_id,track_id,played_at', ignoreDuplicates: true })
  if (insertErr) {
    console.error('[ingestion] play_history upsert failed:', insertErr)
  }

  // Daily aggregates — never reduce existing counts.
  const byDay = new Map<string, { minutes: number; tracks: number }>()
  for (const r of rows) {
    const date = r.played_at.slice(0, 10)
    const minutes = r.duration_ms ? r.duration_ms / 60000 : 3
    const agg = byDay.get(date) ?? { minutes: 0, tracks: 0 }
    agg.minutes += minutes
    agg.tracks += 1
    byDay.set(date, agg)
  }

  for (const [date, agg] of byDay) {
    const { data: existing } = await supabase
      .from('user_listening_stats')
      .select('listening_minutes, track_count')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle()
    const newMinutes = Math.max(existing?.listening_minutes ?? 0, Math.round(agg.minutes))
    const newCount = Math.max(existing?.track_count ?? 0, agg.tracks)
    await supabase.from('user_listening_stats').upsert({
      user_id: userId,
      date,
      listening_minutes: newMinutes,
      track_count: newCount,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date' })
  }

  return { ok: true, inserted: rows.length }
}

// ---------------------------------------------------------------------
// Bulk loop helpers
// ---------------------------------------------------------------------

/**
 * Iterate every user with a row in spotify_tokens. For each, refresh
 * if needed, then call `onUser(userId, accessToken)`. Per-user errors
 * never abort the loop.
 *
 * Returns {users, refreshed, revoked, succeeded, failed} counts.
 */
export async function forEachLinkedUser(
  supabase: SupabaseClient,
  onUser: (userId: string, accessToken: string) => Promise<void>,
  log = (msg: string, extra?: unknown) => console.log(`[ingestion] ${msg}`, extra ?? ''),
): Promise<{
  users: number
  refreshed: number
  revoked: number
  succeeded: number
  failed: number
}> {
  const { data: rows, error } = await supabase
    .from('spotify_tokens')
    .select('user_id, access_token, refresh_token, expires_at, scope')

  if (error) {
    log('spotify_tokens query failed', error)
    return { users: 0, refreshed: 0, revoked: 0, succeeded: 0, failed: 0 }
  }

  const counts = { users: rows?.length ?? 0, refreshed: 0, revoked: 0, succeeded: 0, failed: 0 }
  log(`processing ${counts.users} users`)

  for (const row of rows ?? []) {
    try {
      const tokens = row as StoredSpotifyTokens
      const prevExpiresMs = Date.parse(tokens.expires_at)
      const needsRefresh = !Number.isFinite(prevExpiresMs) || Date.now() >= prevExpiresMs - REFRESH_SKEW_MS

      const { access_token, revoked } = await ensureFreshAccessToken(supabase, tokens)
      if (revoked) {
        counts.revoked++
        log(`user ${tokens.user_id}: refresh_token revoked, row deleted`)
        continue
      }
      if (!access_token) {
        counts.failed++
        log(`user ${tokens.user_id}: refresh failed, skipping`)
        continue
      }
      if (needsRefresh) counts.refreshed++

      await onUser(tokens.user_id, access_token)
      counts.succeeded++
    } catch (err) {
      counts.failed++
      log(`user ${(row as { user_id?: string }).user_id ?? '<unknown>'}: caller threw`, err)
    }

    if (PER_USER_THROTTLE_MS > 0) {
      await new Promise(r => setTimeout(r, PER_USER_THROTTLE_MS))
    }
  }

  log('done', counts)
  return counts
}
