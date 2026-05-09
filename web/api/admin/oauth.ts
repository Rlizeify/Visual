import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin, methodNotAllowed } from '../_admin'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])
  const ctx = await requireAdmin(req, res)
  if (!ctx) return

  const { data, error } = await ctx.supabase
    .from('oauth_connections')
    .select('id, user_id, provider, expires_at, scope, created_at, updated_at, profiles(username, display_name)')
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })

  // Also map user_id → email so the UI can display something human.
  const ids = Array.from(new Set((data ?? []).map(r => r.user_id)))
  const emailById = new Map<string, string | null>()
  if (ids.length > 0) {
    // listUsers is paged; for the small admin scale we accept up to perPage=200.
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
