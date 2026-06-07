// ADMIN LEADERBOARD + VISIBILITY API (merged)
// Routes:
//   GET/PUT - leaderboard_config management (default)
//   GET/PATCH ?type=visibility - user_score_visibility management
//
// Query approach: Uses nested join syntax profiles(username, display_name).
// This requires FK constraint leaderboard_config.user_id → profiles.id.
// See migration 20260509000004_add_profile_fks.sql.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin, logAudit, methodNotAllowed } from '../../_admin.js'

interface SlotInput {
  user_id: string
  position: number
  visible: boolean
}

// Handle score visibility CRUD
async function handleVisibility(req: VercelRequest, res: VercelResponse, ctx: Awaited<ReturnType<typeof requireAdmin>>) {
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

// Handle leaderboard config CRUD
async function handleLeaderboard(req: VercelRequest, res: VercelResponse, ctx: Awaited<ReturnType<typeof requireAdmin>>) {
  if (!ctx) return

  if (req.method === 'GET') {
    // Admin sees all rows including hidden, with profile info attached.
    const { data, error } = await ctx.supabase
      .from('leaderboard_config')
      .select('id, user_id, position, visible, updated_at, profiles(username, display_name)')
      .order('position', { ascending: true })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({
      slots: (data ?? []).map(r => ({
        id: r.id,
        user_id: r.user_id,
        position: r.position,
        visible: r.visible,
        username: (r.profiles as { username?: string | null } | null)?.username ?? null,
        display_name: (r.profiles as { display_name?: string | null } | null)?.display_name ?? null,
        updated_at: r.updated_at,
      })),
    })
  }

  if (req.method === 'PUT') {
    const body = req.body as { slots?: SlotInput[] } | undefined
    const slots = body?.slots
    if (!Array.isArray(slots)) return res.status(400).json({ error: 'expected { slots: [...] }' })

    // Validate.
    for (const s of slots) {
      if (!s.user_id || typeof s.user_id !== 'string') return res.status(400).json({ error: 'each slot needs a user_id string' })
      if (!Number.isInteger(s.position)) return res.status(400).json({ error: 'each slot needs an integer position' })
      if (typeof s.visible !== 'boolean') return res.status(400).json({ error: 'each slot needs a boolean visible' })
    }

    const { data: before } = await ctx.supabase
      .from('leaderboard_config')
      .select('user_id, position, visible')

    // Replace strategy: wipe and re-insert.
    const { error: delErr } = await ctx.supabase.from('leaderboard_config').delete().neq('user_id', '00000000-0000-0000-0000-000000000000')
    if (delErr) return res.status(500).json({ error: delErr.message })

    if (slots.length > 0) {
      const { error: insertErr } = await ctx.supabase.from('leaderboard_config').insert(
        slots.map(s => ({ user_id: s.user_id, position: s.position, visible: s.visible })),
      )
      if (insertErr) return res.status(500).json({ error: insertErr.message })
    }

    await logAudit(ctx, {
      action: 'replace_leaderboard',
      target_type: 'leaderboard_config',
      target_id: null,
      before,
      after: slots,
    })

    return res.status(200).json({ ok: true })
  }

  return methodNotAllowed(res, ['GET', 'PUT'])
}

export async function handler(req: VercelRequest, res: VercelResponse) {
  const ctx = await requireAdmin(req, res)
  if (!ctx) return

  const type = req.query.type as string | undefined

  if (type === 'visibility') {
    return handleVisibility(req, res, ctx)
  }

  return handleLeaderboard(req, res, ctx)
}
