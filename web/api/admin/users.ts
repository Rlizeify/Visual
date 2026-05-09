import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin, logAudit, methodNotAllowed } from '../_admin.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ctx = await requireAdmin(req, res)
  if (!ctx) return

  // Check if this is a single user request (id in query)
  const id = String(req.query.id ?? '')

  if (id) {
    // Single user operations
    if (req.method === 'PATCH') {
      const body = req.body ?? {}
      const patch: Record<string, unknown> = {}
      if (typeof body.username === 'string' || body.username === null) patch.username = body.username
      if (typeof body.display_name === 'string' || body.display_name === null) patch.display_name = body.display_name
      if (typeof body.is_admin === 'boolean') patch.is_admin = body.is_admin
      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ error: 'no editable fields supplied' })
      }

      const { data: before, error: beforeErr } = await ctx.supabase
        .from('profiles')
        .select('id, username, display_name, is_admin')
        .eq('id', id)
        .maybeSingle()
      if (beforeErr) return res.status(500).json({ error: beforeErr.message })
      if (!before) return res.status(404).json({ error: 'profile not found' })

      const { data: after, error: updateErr } = await ctx.supabase
        .from('profiles')
        .update(patch)
        .eq('id', id)
        .select('id, username, display_name, is_admin')
        .single()
      if (updateErr) return res.status(500).json({ error: updateErr.message })

      await logAudit(ctx, {
        action: 'update_profile',
        target_type: 'profile',
        target_id: id,
        before,
        after,
      })

      return res.status(200).json({ profile: after })
    }

    if (req.method === 'DELETE') {
      const { data: profileBefore } = await ctx.supabase
        .from('profiles')
        .select('id, username, display_name, is_admin, created_at')
        .eq('id', id)
        .maybeSingle()
      const { data: userData } = await ctx.supabase.auth.admin.getUserById(id)
      const before = {
        profile: profileBefore,
        auth: userData?.user
          ? { id: userData.user.id, email: userData.user.email, created_at: userData.user.created_at }
          : null,
      }

      const { error: deleteErr } = await ctx.supabase.auth.admin.deleteUser(id)
      if (deleteErr) return res.status(500).json({ error: deleteErr.message })

      await logAudit(ctx, {
        action: 'delete_user',
        target_type: 'auth.user',
        target_id: id,
        before,
        after: null,
      })

      return res.status(200).json({ ok: true })
    }

    return methodNotAllowed(res, ['PATCH', 'DELETE'])
  }

  // List users
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

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
