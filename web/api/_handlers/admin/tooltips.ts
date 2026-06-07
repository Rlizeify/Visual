// ADMIN TOOLTIPS API (merged defaults + overrides)
// Routes:
//   GET/PATCH ?type=defaults - manage tooltip_defaults table
//   GET/PATCH ?type=overrides - manage tooltip_overrides table

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin, methodNotAllowed } from '../../_admin.js'

async function handleDefaults(req: VercelRequest, res: VercelResponse, ctx: Awaited<ReturnType<typeof requireAdmin>>) {
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

async function handleOverrides(req: VercelRequest, res: VercelResponse, ctx: Awaited<ReturnType<typeof requireAdmin>>) {
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

export async function handler(req: VercelRequest, res: VercelResponse) {
  const ctx = await requireAdmin(req, res)
  if (!ctx) return

  const type = req.query.type as string | undefined

  if (type === 'overrides') {
    return handleOverrides(req, res, ctx)
  }

  // Default to defaults
  return handleDefaults(req, res, ctx)
}
