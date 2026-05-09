import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabase } from './_db'
import { signToken } from './_jwt'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

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
  // TODO: Calculate real score from listening data
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
