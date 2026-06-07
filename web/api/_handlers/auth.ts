// Auth handler - Spotify auth + username sign-in.
// Dispatched from /api/index when ?_route=auth.
// Routes:
//   POST ?action=signin-username - sign in with username + password
//   POST - authenticate with Spotify token

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getSupabase } from '../_db.js'
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

  if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
    return generic()
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
    if (error || !data.session || !email) return generic()
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
  let supabase
  try {
    supabase = getSupabase()
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

  // Also upsert user score for the competition leaderboard
  await supabase.from('user_scores').upsert(
    {
      spotify_user_id: spotify_id,
      display_name: display_name || email?.split('@')[0] || 'User',
      score: 0,
      listening_minutes: 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'spotify_user_id' }
  )

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
