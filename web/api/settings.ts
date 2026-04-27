import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from './_db'
import { verifyToken } from './_jwt'

function getSpotifyId(req: VercelRequest, res: VercelResponse): string | null {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' })
    return null
  }
  try {
    const payload = verifyToken(auth.slice(7))
    return payload.spotify_id
  } catch {
    res.status(401).json({ error: 'Invalid token' })
    return null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const spotify_id = getSpotifyId(req, res)
  if (!spotify_id) return

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('spotify_id', spotify_id)
      .single()
    if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message })
    return res.status(200).json({ settings: data?.settings ?? null })
  }

  if (req.method === 'POST') {
    const { settings } = req.body
    const { error } = await supabase.from('user_settings').upsert(
      { spotify_id, settings, updated_at: new Date().toISOString() },
      { onConflict: 'spotify_id' }
    )
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
