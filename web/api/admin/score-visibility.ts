// ADMIN SCORE VISIBILITY TAB API
// Manages user_score_visibility table for per-user visibility settings

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin, methodNotAllowed } from '../_admin.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ctx = await requireAdmin(req, res)
  if (!ctx) return

  if (req.method === 'GET') {
    const { data, error } = await ctx.supabase
      .from('user_score_visibility')
      .select('user_id, score_type, reveal_action')
      .order('user_id')

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ visibility: data || [] })
  }

  if (req.method === 'PATCH') {
    const { user_id, score_type, reveal_action } = req.body as {
      user_id?: string
      score_type?: string
      reveal_action?: boolean
    }

    if (!user_id || !score_type || typeof reveal_action !== 'boolean') {
      return res.status(400).json({ error: 'user_id, score_type, and reveal_action required' })
    }

    const { error } = await ctx.supabase
      .from('user_score_visibility')
      .upsert({
        user_id,
        score_type,
        reveal_action,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,score_type',
      })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return methodNotAllowed(res, ['GET', 'PATCH'])
}
