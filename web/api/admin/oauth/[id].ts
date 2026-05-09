import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin, logAudit, methodNotAllowed } from '../../_admin'

// Disconnecting only removes our row. The provider-side OAuth grant remains
// valid until the user revokes it from Spotify/Discord/etc — we don't have
// a revoke flow plumbed in. The audit log captures this so an admin can
// follow up out of band if needed.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') return methodNotAllowed(res, ['DELETE'])
  const ctx = await requireAdmin(req, res)
  if (!ctx) return

  const id = String(req.query.id ?? '')
  if (!id) return res.status(400).json({ error: 'missing connection id' })

  const { data: before, error: beforeErr } = await ctx.supabase
    .from('oauth_connections')
    .select('id, user_id, provider, expires_at, scope, created_at')
    .eq('id', id)
    .maybeSingle()
  if (beforeErr) return res.status(500).json({ error: beforeErr.message })
  if (!before) return res.status(404).json({ error: 'connection not found' })

  const { error: deleteErr } = await ctx.supabase
    .from('oauth_connections')
    .delete()
    .eq('id', id)
  if (deleteErr) return res.status(500).json({ error: deleteErr.message })

  await logAudit(ctx, {
    action: 'disconnect_oauth',
    target_type: 'oauth_connection',
    target_id: id,
    before,
    after: null,
  })

  return res.status(200).json({ ok: true })
}
