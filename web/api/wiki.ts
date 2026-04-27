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
      .from('wiki_entries')
      .select('*')
      .eq('spotify_id', spotify_id)
      .order('updated_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ entries: data })
  }

  if (req.method === 'POST') {
    const { id, category, title, content } = req.body
    const entry: Record<string, unknown> = {
      spotify_id,
      category,
      title,
      content,
      updated_at: new Date().toISOString(),
    }
    if (id) entry.id = id

    const { data, error } = await supabase
      .from('wiki_entries')
      .upsert(entry, { onConflict: 'id' })
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ entry: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
