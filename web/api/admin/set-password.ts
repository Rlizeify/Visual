import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin, logAudit, methodNotAllowed } from '../_admin'

// Force-setting a user's password is the most dangerous primitive in the
// admin console. Gated to the super admin (CB) only; every regular admin
// gets 403. Audit log records the action with no plaintext password — the
// fact-of-event is recorded but not the value.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  const ctx = await requireAdmin(req, res)
  if (!ctx) return

  if (!ctx.isSuperAdmin) {
    return res.status(403).json({ error: 'super admin only' })
  }

  const { user_id, new_password } = (req.body ?? {}) as { user_id?: string; new_password?: string }
  if (!user_id || typeof user_id !== 'string') {
    return res.status(400).json({ error: 'missing user_id' })
  }
  if (!new_password || typeof new_password !== 'string' || new_password.length < 8) {
    return res.status(400).json({ error: 'new_password must be at least 8 characters' })
  }

  const { data, error } = await ctx.supabase.auth.admin.updateUserById(user_id, {
    password: new_password,
  })
  if (error) return res.status(500).json({ error: error.message })

  await logAudit(ctx, {
    action: 'force_set_password',
    target_type: 'auth.user',
    target_id: user_id,
    before: null,
    // Intentionally no password value in audit — only the fact-of-event.
    after: { email: data?.user?.email ?? null },
  })

  return res.status(200).json({ ok: true })
}
