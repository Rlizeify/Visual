// ADMIN TOOLTIPS DEFAULTS API
// Manages tooltip_defaults table for site-wide tooltip text

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin, methodNotAllowed } from '../../_admin.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ctx = await requireAdmin(req, res)
  if (!ctx) return

  if (req.method === 'GET') {
    const { data, error } = await ctx.supabase
      .from('tooltip_defaults')
      .select('score_type, text')
      .order('score_type')

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ defaults: data || [] })
  }

  if (req.method === 'PATCH') {
    const { score_type, text } = req.body as { score_type?: string; text?: string }

    if (!score_type || typeof text !== 'string') {
      return res.status(400).json({ error: 'score_type and text required' })
    }

    const { error } = await ctx.supabase
      .from('tooltip_defaults')
      .upsert({
        score_type,
        text,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'score_type',
      })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return methodNotAllowed(res, ['GET', 'PATCH'])
}
