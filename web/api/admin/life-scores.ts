// ADMIN LIFE SCORES TAB API
// Query approach: Uses nested join syntax profiles(username, display_name).
// This requires FK constraint life_score_derivatives.user_id → profiles.id.
// See migration 20260509000004_add_profile_fks.sql.
// If you see "Could not find relationship" errors, run that migration.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin, logAudit, methodNotAllowed } from '../_admin.js'

const FIELDS = ['position', 'velocity', 'acceleration', 'jerk', 'snap'] as const
type Field = typeof FIELDS[number]

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ctx = await requireAdmin(req, res)
  if (!ctx) return

  // Check if this is a single derivative update (user_id and metric in query)
  const user_id = String(req.query.user_id ?? '')
  const metric = String(req.query.metric ?? '')

  if (user_id && metric && req.method === 'PATCH') {
    const body = (req.body ?? {}) as Partial<Record<Field, number>>
    const patch: Record<string, number> = {}
    for (const f of FIELDS) {
      const v = body[f]
      if (typeof v === 'number' && Number.isFinite(v)) patch[f] = v
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'no derivative fields supplied' })
    }

    const { data: before, error: beforeErr } = await ctx.supabase
      .from('life_score_derivatives')
      .select('user_id, metric, position, velocity, acceleration, jerk, snap')
      .eq('user_id', user_id)
      .eq('metric', metric)
      .maybeSingle()
    if (beforeErr) return res.status(500).json({ error: beforeErr.message })
    if (!before) return res.status(404).json({ error: 'derivative row not found' })

    const { data: after, error: updateErr } = await ctx.supabase
      .from('life_score_derivatives')
      .update({ ...patch, computed_at: new Date().toISOString() })
      .eq('user_id', user_id)
      .eq('metric', metric)
      .select('user_id, metric, position, velocity, acceleration, jerk, snap, computed_at')
      .single()
    if (updateErr) return res.status(500).json({ error: updateErr.message })

    await logAudit(ctx, {
      action: 'update_life_score_derivative',
      target_type: 'life_score_derivative',
      target_id: `${user_id}:${metric}`,
      before,
      after,
    })

    return res.status(200).json({ derivative: after })
  }

  // List all derivatives
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET', 'PATCH'])

  const { data, error } = await ctx.supabase
    .from('life_score_derivatives')
    .select('id, user_id, metric, position, velocity, acceleration, jerk, snap, computed_at, profiles(username, display_name)')
    .order('computed_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })

  const rows = (data ?? []).map(r => ({
    id: r.id,
    user_id: r.user_id,
    username: (r.profiles as { username?: string | null } | null)?.username ?? null,
    display_name: (r.profiles as { display_name?: string | null } | null)?.display_name ?? null,
    metric: r.metric,
    position: r.position,
    velocity: r.velocity,
    acceleration: r.acceleration,
    jerk: r.jerk,
    snap: r.snap,
    computed_at: r.computed_at,
  }))

  return res.status(200).json({ derivatives: rows })
}
