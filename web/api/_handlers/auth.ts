// Auth handler - Spotify auth + username lookup.
// Dispatched from /api/index when ?_route=auth.
// Routes:
//   POST ?action=lookup-email - lookup email by username (for login)
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

async function handleLookupEmail(req: VercelRequest, res: VercelResponse) {
  const { username } = req.body as { username?: string }
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Username required' })
  }

  const supabase = getServiceSupabase()

  // Look up profile by username
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username.toLowerCase())
    .maybeSingle()

  if (profileError) {
    return res.status(500).json({ error: profileError.message })
  }

  if (!profile) {
    return res.status(404).json({ error: 'Username not found' })
  }

  // Get email from auth.users using service role
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(profile.id)

  if (userError || !userData?.user?.email) {
    return res.status(404).json({ error: 'User not found' })
  }

  return res.status(200).json({ email: userData.user.email })
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

  if (action === 'lookup-email') {
    return handleLookupEmail(req, res)
  }

  return handleSpotifyAuth(req, res)
}
