import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin, methodNotAllowed } from '../_admin'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])
  const ctx = await requireAdmin(req, res)
  if (!ctx) return

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
