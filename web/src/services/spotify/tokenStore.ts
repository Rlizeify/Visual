// Spotify token persistence.
//
// Supabase `spotify_tokens` is the source of truth (per-user, self-only
// RLS). In-memory cache fronts every read for performance. Local
// storage is no longer written; it's only read once for the one-time
// migration of pre-existing users (see migrateFromLocalStorage).
//
// Lifecycle:
//   App boot → AuthContext loads session → effect calls
//     setUserAndHydrate(user.id) → hydrates mem from spotify_tokens
//     (or migrates from legacy localStorage), caches via
//     sessionStorage so subsequent boots in the same tab skip the
//     round-trip.
//   OAuth callback → setTokens(t) writes mem + upserts Supabase.
//   Refresh        → updateAccess(...) writes mem + upserts Supabase.
//   Sign-out       → clearLocal() — mem only, row persists.
//   Disconnect     → disconnect() deletes the row + clears mem.
//   Refresh-token revoked → notifyRefreshInvalid() — emits, then
//     deletes the row so the next link starts clean.
//
// Errors never throw to callers. They're surfaced through subscribe()
// so a banner can prompt the user. Tokens remain functional in memory
// even when persistence fails.

import { supabase } from '../../lib/supabase'

export interface SpotifyTokens {
  access_token: string
  refresh_token: string
  expires_at: string  // ISO 8601
  scope: string | null
}

export type SpotifyTokenEvent =
  | { kind: 'save_failed'; message: string }
  | { kind: 'load_failed'; message: string }
  | { kind: 'refresh_invalid' }
  | { kind: 'migrated' }

const SS_HYDRATED_KEY = 'mheu_spotify_hydrated'
const LEGACY_ACCESS = 'mheu_access_token'
const LEGACY_REFRESH = 'mheu_refresh_token'
const LEGACY_EXPIRY = 'mheu_token_expiry'

let mem: SpotifyTokens | null = null
let currentUserId: string | null = null
const listeners = new Set<(e: SpotifyTokenEvent) => void>()

function emit(e: SpotifyTokenEvent) {
  listeners.forEach(fn => {
    try { fn(e) } catch (err) { console.warn('[spotify-tokens] listener threw:', err) }
  })
}

export function subscribe(fn: (e: SpotifyTokenEvent) => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

// ---------- Reads ----------

export function getAccessToken(): string | null {
  return mem?.access_token ?? null
}

export function getRefreshToken(): string | null {
  return mem?.refresh_token ?? null
}

export function getExpiresAtMs(): number | null {
  if (!mem?.expires_at) return null
  const ms = Date.parse(mem.expires_at)
  return Number.isFinite(ms) ? ms : null
}

export function hasTokens(): boolean {
  return !!mem
}

// ---------- Hydration ----------

/** Outcome of `setUserAndHydrate`. Routing decisions key off this. */
export type HydrationOutcome = 'linked' | 'not-linked' | 'error'

const HYDRATE_TIMEOUT_MS = 8000

/**
 * Load this user's spotify_tokens row into the in-memory cache.
 *
 * Always resolves — never rejects. The returned outcome tells callers
 * how to route:
 *   - 'linked'      — tokens are now in `mem`. App goes to /m.
 *   - 'not-linked'  — no row + no migratable legacy keys. App goes to /spotify-login.
 *   - 'error'       — Supabase down OR 8s timeout. App treats as not-linked
 *                     for routing but surfaces a banner.
 *
 * Idempotent within a session via `sessionStorage.mheu_spotify_hydrated`.
 * Re-calling for the same userId after a successful hydrate returns
 * the current in-memory state without a round-trip.
 */
export async function setUserAndHydrate(userId: string): Promise<HydrationOutcome> {
  currentUserId = userId
  try {
    // The sessionStorage flag persists across page reloads but the
    // module-level `mem` does not — every reload wipes it. The original
    // check returned `mem ? 'linked' : 'not-linked'` and so reported
    // not-linked for every page refresh of a previously-linked user
    // (mem null, flag set) — bouncing returning users to /spotify-login.
    // Only short-circuit when `mem` is actually populated. Otherwise
    // fall through and re-fetch from Supabase.
    if (sessionStorage.getItem(SS_HYDRATED_KEY) === userId && mem) {
      return 'linked'
    }
  } catch { /* private mode — fall through, re-hydrate every time */ }

  // Race the Supabase round-trip against an 8s wall so a slow / dead
  // Supabase can't block app boot indefinitely.
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<HydrationOutcome>(resolve => {
    timeoutId = setTimeout(() => {
      console.warn('[spotify-tokens] hydrate timed out after', HYDRATE_TIMEOUT_MS, 'ms')
      emit({ kind: 'load_failed', message: 'Timed out loading Spotify tokens' })
      resolve('error')
    }, HYDRATE_TIMEOUT_MS)
  })

  const work = (async (): Promise<HydrationOutcome> => {
    try {
      const { data, error } = await supabase
        .from('spotify_tokens')
        .select('access_token, refresh_token, expires_at, scope')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) {
        console.warn('[spotify-tokens] hydrate failed:', error.message)
        emit({ kind: 'load_failed', message: error.message })
        return 'error'
      }
      if (data) {
        mem = data as SpotifyTokens
        markHydrated(userId)
        clearLegacyLocalStorage()
        return 'linked'
      }
      // No Supabase row — try the one-time migration from legacy keys.
      // TODO(2026-06-23): delete migrateFromLocalStorage 30 days after ship.
      const migrated = await migrateFromLocalStorage(userId)
      if (migrated) emit({ kind: 'migrated' })
      markHydrated(userId)
      return mem ? 'linked' : 'not-linked'
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[spotify-tokens] hydrate exception:', msg)
      emit({ kind: 'load_failed', message: msg })
      return 'error'
    }
  })()

  try {
    return await Promise.race([work, timeoutPromise])
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  }
}

// ---------- Writes ----------

export async function setTokens(t: SpotifyTokens): Promise<void> {
  mem = t
  const userId = await resolveUserId()
  if (!userId) {
    console.warn('[spotify-tokens] setTokens: no Supabase user yet; kept in memory only')
    return
  }
  await persist(userId, t)
}

/**
 * Update access_token (and optionally a rotated refresh_token) after a
 * successful refresh. No-op if there's nothing in memory to update.
 */
export function updateAccess(access_token: string, expires_at: string, refresh_token?: string): void {
  if (!mem) {
    console.warn('[spotify-tokens] updateAccess called with no tokens in memory')
    return
  }
  mem = {
    ...mem,
    access_token,
    expires_at,
    refresh_token: refresh_token ?? mem.refresh_token,
  }
  // Best-effort persist; do not block callers.
  void (async () => {
    const userId = await resolveUserId()
    if (!userId || !mem) return
    await persist(userId, mem)
  })()
}

// ---------- Lifecycle ----------

/** Sign-out cleanup. Clears in-memory only; the Supabase row persists. */
export function clearLocal(): void {
  mem = null
  currentUserId = null
  try { sessionStorage.removeItem(SS_HYDRATED_KEY) } catch { /* private mode */ }
}

/** Full unlink. Deletes Supabase row + clears in-memory state + legacy keys. */
export async function disconnect(): Promise<void> {
  const userId = currentUserId ?? (await resolveUserId())
  mem = null
  try { sessionStorage.removeItem(SS_HYDRATED_KEY) } catch { /* private mode */ }
  clearLegacyLocalStorage()
  if (!userId) return
  const { error } = await supabase
    .from('spotify_tokens')
    .delete()
    .eq('user_id', userId)
  if (error) console.warn('[spotify-tokens] disconnect failed:', error.message)
  currentUserId = null
}

/** Called when refresh_token is rejected by Spotify (revoked or invalid). */
export function notifyRefreshInvalid(): void {
  emit({ kind: 'refresh_invalid' })
  void disconnect()
}

// ---------- Internals ----------

async function resolveUserId(): Promise<string | null> {
  if (currentUserId) return currentUserId
  try {
    const { data } = await supabase.auth.getUser()
    const id = data.user?.id ?? null
    if (id) currentUserId = id
    return id
  } catch {
    return null
  }
}

async function persist(userId: string, t: SpotifyTokens): Promise<void> {
  try {
    const { error } = await supabase
      .from('spotify_tokens')
      .upsert(
        {
          user_id: userId,
          access_token: t.access_token,
          refresh_token: t.refresh_token,
          expires_at: t.expires_at,
          scope: t.scope,
        },
        { onConflict: 'user_id' },
      )
    if (error) {
      console.warn('[spotify-tokens] save failed:', error.message)
      emit({ kind: 'save_failed', message: error.message })
      return
    }
    markHydrated(userId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[spotify-tokens] save exception:', msg)
    emit({ kind: 'save_failed', message: msg })
  }
}

function markHydrated(userId: string) {
  try { sessionStorage.setItem(SS_HYDRATED_KEY, userId) } catch { /* private mode */ }
}

function clearLegacyLocalStorage() {
  try {
    localStorage.removeItem(LEGACY_ACCESS)
    localStorage.removeItem(LEGACY_REFRESH)
    localStorage.removeItem(LEGACY_EXPIRY)
  } catch { /* private mode */ }
}

// TODO(2026-06-23): remove this shim 30 days after ship. After that
// date, users who never signed in during the migration window will
// need to re-link Spotify manually, which is the same UX as a brand
// new browser.
//
// HARDENING (2026-05-24): a single broken legacy value (e.g. `expiry`
// containing "NaN", "Infinity", or some other corruption) caused
// `new Date(...).toISOString()` to throw RangeError. That throw
// propagated through the awaited chain inside `setUserAndHydrate`
// and contributed to a forever-spinning loading screen on Stone's
// browser. The original try/catch only covered the three localStorage
// reads. The whole body is now wrapped — every failure path nukes
// the offending legacy keys and returns cleanly so boot continues.
// Losing one user's pre-migration localStorage tokens is acceptable:
// they re-link Spotify once.
async function migrateFromLocalStorage(userId: string): Promise<boolean> {
  try {
    let access: string | null = null
    let refresh: string | null = null
    let expiry: string | null = null
    try {
      access = localStorage.getItem(LEGACY_ACCESS)
      refresh = localStorage.getItem(LEGACY_REFRESH)
      expiry = localStorage.getItem(LEGACY_EXPIRY)
    } catch (err) {
      console.warn('[spotify-tokens] migration: localStorage read failed:', err)
      return false
    }
    if (!access || !refresh || !expiry) return false

    const expiryMs = parseInt(expiry, 10)
    if (!Number.isFinite(expiryMs)) {
      console.warn('[spotify-tokens] migration: legacy expiry not a finite number:', expiry)
      clearLegacyLocalStorage()
      return false
    }

    let expiresAt: string
    try {
      expiresAt = new Date(expiryMs).toISOString()
    } catch (err) {
      // RangeError on Invalid Date — `expiryMs` was out of valid range.
      console.warn('[spotify-tokens] migration: legacy expiry out of Date range:', expiryMs, err)
      clearLegacyLocalStorage()
      return false
    }

    const tokens: SpotifyTokens = {
      access_token: access,
      refresh_token: refresh,
      expires_at: expiresAt,
      scope: null,
    }
    mem = tokens
    currentUserId = userId

    try {
      await persist(userId, tokens)
    } catch (err) {
      // persist already swallows + emits its own errors, but guard
      // anyway so a throw can't escape the migration shim.
      console.warn('[spotify-tokens] migration: persist threw:', err)
    }

    // Clear legacy keys even if persist failed — keeping them around
    // risks them shadowing the Supabase truth on the next retry path.
    // Tokens remain in memory for this session.
    clearLegacyLocalStorage()
    console.info('[spotify-tokens] migrated tokens from localStorage to Supabase')
    return true
  } catch (err) {
    // Last-resort catch — migration is strictly best-effort. Boot
    // continues; user re-links Spotify if needed.
    console.warn('[spotify-tokens] migration: unexpected error, clearing legacy keys:', err)
    try { clearLegacyLocalStorage() } catch { /* noop */ }
    return false
  }
}
