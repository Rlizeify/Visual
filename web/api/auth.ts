import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from './_db'
import { signToken } from './_jwt'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { spotifyAccessToken } = req.body
  if (!spotifyAccessToken) return res.status(400).json({ error: 'Missing spotifyAccessToken' })

  const spotifyRes = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${spotifyAccessToken}` },
  })
  if (!spotifyRes.ok) return res.status(401).json({ error: 'Invalid Spotify token' })

  const me = await spotifyRes.json()
  const { id: spotify_id, display_name, email } = me

  const { error } = await supabase.from('users').upsert(
    { spotify_id, display_name, email },
    { onConflict: 'spotify_id' }
  )
  if (error) return res.status(500).json({ error: error.message })

  const token = signToken({ spotify_id, display_name })
  return res.status(200).json({ token })
}
