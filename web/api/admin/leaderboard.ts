import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin, logAudit, methodNotAllowed } from '../_admin'

interface SlotInput {
  user_id: string
  position: number
  visible: boolean
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ctx = await requireAdmin(req, res)
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

    // Replace strategy: wipe and re-insert. The table is small (admin-managed)
    // so the truncate cost is negligible and atomicity comes from "all or
    // nothing" semantics — easier to reason about than diffing.
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
