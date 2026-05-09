// ADMIN TOOLTIPS OVERRIDES API
// Manages tooltip_overrides table for per-user tooltip text

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin, methodNotAllowed } from '../../_admin.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ctx = await requireAdmin(req, res)
  if (!ctx) return

  if (req.method === 'GET') {
    const { data, error } = await ctx.supabase
      .from('tooltip_overrides')
      .select('user_id, score_type, text')
      .order('user_id')

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ overrides: data || [] })
  }

  if (req.method === 'PATCH') {
    const { user_id, score_type, text } = req.body as {
      user_id?: string
      score_type?: string
      text?: string
    }

    if (!user_id || !score_type || typeof text !== 'string') {
      return res.status(400).json({ error: 'user_id, score_type, and text required' })
    }

    // If text is empty, delete the override
    if (text === '') {
      const { error } = await ctx.supabase
        .from('tooltip_overrides')
        .delete()
        .eq('user_id', user_id)
        .eq('score_type', score_type)

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ ok: true, deleted: true })
    }

    const { error } = await ctx.supabase
      .from('tooltip_overrides')
      .upsert({
        user_id,
        score_type,
        text,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,score_type',
      })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return methodNotAllowed(res, ['GET', 'PATCH'])
}
