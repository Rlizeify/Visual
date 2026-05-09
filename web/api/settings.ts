import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabase } from './_db'
import { getSpotifyId } from './_auth'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let supabase
  try {
    supabase = getSupabase()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Database configuration error'
    console.error('[settings] ' + msg)
    return res.status(500).json({ error: msg })
  }

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
