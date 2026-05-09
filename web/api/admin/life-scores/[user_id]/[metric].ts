import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin, logAudit, methodNotAllowed } from '../../../_admin'

const FIELDS = ['position', 'velocity', 'acceleration', 'jerk', 'snap'] as const
type Field = typeof FIELDS[number]

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH') return methodNotAllowed(res, ['PATCH'])
  const ctx = await requireAdmin(req, res)
  if (!ctx) return

  const user_id = String(req.query.user_id ?? '')
  const metric = String(req.query.metric ?? '')
  if (!user_id || !metric) return res.status(400).json({ error: 'missing user_id or metric' })

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
