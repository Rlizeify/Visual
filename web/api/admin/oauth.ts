import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin, logAudit, methodNotAllowed } from '../_admin'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ctx = await requireAdmin(req, res)
  if (!ctx) return

  // Check if this is a single connection request (id in query)
  const id = String(req.query.id ?? '')

  if (id && req.method === 'DELETE') {
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

  // List connections
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET', 'DELETE'])

  const { data, error } = await ctx.supabase
    .from('oauth_connections')
    .select('id, user_id, provider, expires_at, scope, created_at, updated_at, profiles(username, display_name)')
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })

  const ids = Array.from(new Set((data ?? []).map(r => r.user_id)))
  const emailById = new Map<string, string | null>()
  if (ids.length > 0) {
    const { data: usersData } = await ctx.supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
    for (const u of usersData?.users ?? []) {
      if (ids.includes(u.id)) emailById.set(u.id, u.email ?? null)
    }
  }

  const rows = (data ?? []).map(r => ({
    id: r.id,
    user_id: r.user_id,
    email: emailById.get(r.user_id) ?? null,
    username: (r.profiles as { username?: string | null } | null)?.username ?? null,
    display_name: (r.profiles as { display_name?: string | null } | null)?.display_name ?? null,
    provider: r.provider,
    expires_at: r.expires_at,
    scope: r.scope,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }))

  return res.status(200).json({ connections: rows })
}
