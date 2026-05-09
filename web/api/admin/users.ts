import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin, methodNotAllowed } from '../_admin'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])
  const ctx = await requireAdmin(req, res)
  if (!ctx) return

  const { data: usersData, error: usersErr } = await ctx.supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  })
  if (usersErr) return res.status(500).json({ error: usersErr.message })

  const ids = usersData.users.map(u => u.id)
  const { data: profiles, error: profilesErr } = await ctx.supabase
    .from('profiles')
    .select('id, username, display_name, is_admin, created_at')
    .in('id', ids)
  if (profilesErr) return res.status(500).json({ error: profilesErr.message })

  const byId = new Map((profiles ?? []).map(p => [p.id, p]))
  const merged = usersData.users.map(u => {
    const p = byId.get(u.id)
    return {
      id: u.id,
      email: u.email ?? null,
      username: p?.username ?? null,
      display_name: p?.display_name ?? null,
      is_admin: p?.is_admin ?? false,
      created_at: u.created_at,
      last_sign_in: u.last_sign_in_at ?? null,
    }
  })

  return res.status(200).json({ users: merged })
}
