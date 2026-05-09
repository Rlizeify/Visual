import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin, logAudit, methodNotAllowed } from '../_admin.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
  const ctx = await requireAdmin(req, res)
  if (!ctx) return

  const { email } = (req.body ?? {}) as { email?: string }
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'missing email' })
  }

  // generateLink with type=recovery sends the email AND returns the link.
  // We do not return the link to the client — that's an audit detail only.
  const { data, error } = await ctx.supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
  })
  if (error) return res.status(500).json({ error: error.message })

  await logAudit(ctx, {
    action: 'reset_password',
    target_type: 'auth.user',
    target_id: data?.user?.id ?? null,
    before: null,
    after: { email },
  })

  return res.status(200).json({ ok: true })
}
