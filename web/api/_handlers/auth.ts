// Auth handler - Spotify auth + username sign-in.
// Dispatched from /api/index when ?_route=auth.
// Routes:
//   POST ?action=signin-username - sign in with username + password
//   POST - authenticate with Spotify token

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { signToken } from '../_jwt.js'

function getServiceSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function getAnonSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// Lockout: 5 failures in 15 min per username or per IP locks that key for
// 15 min (public.auth_throttle_*, migration 20261107000001). Locking by
// username whether or not it exists keeps the response from revealing
// which usernames are real.
function throttleKeys(req: VercelRequest, username: string): string[] {
  const fwd = req.headers['x-forwarded-for']
  const ip = (Array.isArray(fwd) ? fwd[0] : fwd ?? '').split(',')[0].trim() || 'unknown'
  return [`u:${username.toLowerCase()}`, `ip:${ip}`]
}

async function throttle(fn: 'auth_throttle_locked' | 'auth_throttle_fail' | 'auth_throttle_clear', keys: string[]) {
  try {
    const { data, error } = await getServiceSupabase().rpc(fn, { p_keys: keys })
    if (error) throw error
    return typeof data === 'number' ? data : 0
  } catch (err) {
    console.error(`[auth] ${fn} failed:`, err)
    return 0
  }
}

// Single endpoint that resolves a username to its email AND attempts the
// password sign-in in one call. Replaces the previous two-call flow
// (lookup-email + supabase.auth.signInWithPassword) which leaked usernames:
// a 404 from lookup-email meant the username was unregistered, and a 200
// returned the email outright. This handler returns a uniform "Invalid
// credentials" for every failure shape (unknown username, missing user
// row, wrong password) so a probing client can't distinguish them.
async function handleSigninByUsername(req: VercelRequest, res: VercelResponse) {
  const { username, password } = req.body as { username?: string; password?: string }
  const generic = () => res.status(401).json({ error: 'Invalid credentials' })

  if (!username || typeof username !== 'string' || !password || typeof password !== 'string'
    || username.length > 64 || password.length > 256) {
    return generic()
  }

  const keys = throttleKeys(req, username)
  const lockedFor = await throttle('auth_throttle_locked', keys)
  if (lockedFor > 0) {
    res.setHeader('Retry-After', String(lockedFor))
    return res.status(429).json({ error: `Too many attempts. Try again in ${Math.ceil(lockedFor / 60)} min.` })
  }

  let email: string | undefined
  try {
    const service = getServiceSupabase()
    const { data: profile } = await service
      .from('profiles')
      .select('id')
      .eq('username', username.toLowerCase())
      .maybeSingle()
    if (profile?.id) {
      const { data: userData } = await service.auth.admin.getUserById(profile.id)
      email = userData?.user?.email ?? undefined
    }
  } catch (err) {
    console.error('[auth] signin-username lookup failed:', err)
    return generic()
  }

  // If username is unknown, still run a no-op signin against a deterministic
  // sentinel so the response timing is comparable to the success path —
  // Supabase will reject it with the same "Invalid login credentials" error
  // we surface for a wrong password.
  const candidateEmail = email ?? `nx-${Date.now()}@invalid.local`

  try {
    const anon = getAnonSupabase()
    const { data, error } = await anon.auth.signInWithPassword({ email: candidateEmail, password })
    if (error || !data.session || !email) {
      await throttle('auth_throttle_fail', keys)
      return generic()
    }
    await throttle('auth_throttle_clear', keys.slice(0, 1))
    return res.status(200).json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    })
  } catch (err) {
    console.error('[auth] signin-username password check failed:', err)
    return generic()
  }
}

async function handleSpotifyAuth(req: VercelRequest, res: VercelResponse) {
  // Service role: public.users holds emails, so it must not depend on
  // anon-key RLS policies (see migration 20261103000002).
  let supabase
  try {
    supabase = getServiceSupabase()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Database configuration error'
    console.error('[auth] ' + msg)
    return res.status(500).json({ error: msg })
  }

  const { spotifyAccessToken } = req.body
  if (!spotifyAccessToken) return res.status(400).json({ error: 'Missing spotifyAccessToken' })

  const spotifyRes = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${spotifyAccessToken}` },
  })
  if (!spotifyRes.ok) return res.status(401).json({ error: 'Invalid Spotify token' })

  const me = await spotifyRes.json()
  const { id: spotify_id, display_name, email } = me

  let token: string
  try {
    token = signToken({ spotify_id, display_name })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Token signing error'
    console.error('[auth] ' + msg)
    return res.status(500).json({ error: msg })
  }

  const { error } = await supabase.from('users').upsert(
    { spotify_id, display_name, email },
    { onConflict: 'spotify_id' }
  )
  if (error) return res.status(500).json({ error: error.message })

  // Note: we used to seed a user_scores row here keyed on spotify_user_id
  // with user_id=NULL. That path produced duplicate orphan rows for every
  // Spotify login (see INV1 Session 6). Scoring is owned end-to-end by
  // the modern pipeline (POST /api/scores?action=recompute + the daily
  // cron at /api/cron?job=recompute), both of which key on user_id and
  // resolve it from the Supabase session — no seed row needed.

  return res.status(200).json({ token })
}

export async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const action = req.query.action as string | undefined

  if (action === 'signin-username') {
    return handleSigninByUsername(req, res)
  }

  return handleSpotifyAuth(req, res)
}
