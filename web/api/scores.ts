import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSupabase } from './_db.js'
import { getSpotifyId } from './_auth.js'

const PAGE_SIZE = 50

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let supabase
  try {
    supabase = getSupabase()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Database configuration error'
    console.error('[scores] ' + msg)
    return res.status(500).json({ error: msg })
  }

  // GET - list scores for leaderboard (public)
  if (req.method === 'GET') {
    const page = parseInt(String(req.query.page || '1'), 10)
    const offset = (page - 1) * PAGE_SIZE

    const { data, error, count } = await supabase
      .from('user_scores')
      .select('spotify_user_id, display_name, score, listening_minutes, top_genre, updated_at', { count: 'exact' })
      .order('score', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      console.error('[scores] GET error:', error.message)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({
      scores: data || [],
      total: count || 0,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.ceil((count || 0) / PAGE_SIZE),
    })
  }

  // POST - upsert user score (requires auth)
  if (req.method === 'POST') {
    const spotify_id = getSpotifyId(req, res)
    if (!spotify_id) return

    const { display_name, listening_minutes, top_genre } = req.body

    if (!display_name || typeof display_name !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid display_name' })
    }

    // TODO: Replace with real scoring algorithm
    // For now, score = listening_minutes as a placeholder
    const score = typeof listening_minutes === 'number' ? listening_minutes : 0

    const { error } = await supabase
      .from('user_scores')
      .upsert(
        {
          spotify_user_id: spotify_id,
          display_name,
          score,
          listening_minutes: listening_minutes || 0,
          top_genre: top_genre || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'spotify_user_id' }
      )

    if (error) {
      console.error('[scores] POST error:', error.message)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
