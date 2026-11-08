// ADMIN USERS API (includes password operations)
// Routes:
//   GET - list all users
//   PATCH ?id=<user_id> - update profile and/or feature grants
//         body: { username?, display_name?, is_admin?, features?: string[] }
//         `features` is the full list of granted keys (lib/features.ts).
//   DELETE ?id=<user_id> - delete user
//   POST ?action=reset-password - send password reset email
//   POST ?action=set-password - force-set password (super admin only)

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin, logAudit, methodNotAllowed } from '../../_admin.js'
import { FEATURES, isFeatureKey } from '../../../src/lib/features.js'
import { passwordProblems, isBreachedPassword } from '../../../src/lib/password.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function handleResetPassword(req: VercelRequest, res: VercelResponse, ctx: Awaited<ReturnType<typeof requireAdmin>>) {
  if (!ctx) return

  const { email } = (req.body ?? {}) as { email?: string }
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'missing email' })
  }

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

async function handleSetPassword(req: VercelRequest, res: VercelResponse, ctx: Awaited<ReturnType<typeof requireAdmin>>) {
  if (!ctx) return

  if (!ctx.isSuperAdmin) {
    return res.status(403).json({ error: 'super admin only' })
  }

  const { user_id, new_password } = (req.body ?? {}) as { user_id?: string; new_password?: string }
  if (!user_id || typeof user_id !== 'string') {
    return res.status(400).json({ error: 'missing user_id' })
  }
  if (!new_password || typeof new_password !== 'string') {
    return res.status(400).json({ error: 'missing new_password' })
  }
  const { data: target } = await ctx.supabase.auth.admin.getUserById(user_id)
  const problems = passwordProblems(new_password, [target?.user?.email])
  if (problems.length) return res.status(400).json({ error: `weak password: ${problems.join('; ')}` })
  if (await isBreachedPassword(new_password)) {
    return res.status(400).json({ error: 'this password appears in a known data breach — pick another' })
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
    after: { email: data?.user?.email ?? null },
  })

  return res.status(200).json({ ok: true })
}

export async function handler(req: VercelRequest, res: VercelResponse) {
  const ctx = await requireAdmin(req, res)
  if (!ctx) return

  // Handle POST actions (password operations)
  if (req.method === 'POST') {
    const action = req.query.action as string | undefined
    if (action === 'reset-password') {
      return handleResetPassword(req, res, ctx)
    }
    if (action === 'set-password') {
      return handleSetPassword(req, res, ctx)
    }
    return res.status(400).json({ error: 'unknown action' })
  }

  // Check if this is a single user request (id in query)
  const id = String(req.query.id ?? '')

  if (id) {
    if (!UUID.test(id)) return res.status(400).json({ error: 'invalid id' })
    // Single user operations
    if (req.method === 'PATCH') {
      const body = req.body ?? {}
      const patch: Record<string, unknown> = {}
      if (typeof body.username === 'string' || body.username === null) patch.username = body.username
      if (typeof body.display_name === 'string' || body.display_name === null) patch.display_name = body.display_name
      if (typeof body.is_admin === 'boolean') patch.is_admin = body.is_admin
      let features: string[] | null = null
      if (body.features !== undefined) {
        if (!Array.isArray(body.features) || !body.features.every(isFeatureKey)) {
          return res.status(400).json({ error: `features must be a list of: ${FEATURES.map(f => f.key).join(', ')}` })
        }
        features = [...new Set(body.features as string[])]
      }
      if (Object.keys(patch).length === 0 && !features) {
        return res.status(400).json({ error: 'no editable fields supplied' })
      }
      // Granting or revoking admin is reserved for super admins
      // (SUPER_ADMIN_EMAILS), so a compromised admin can't mint more.
      if ('is_admin' in patch && !ctx.isSuperAdmin) {
        const { data: cur } = await ctx.supabase.from('profiles').select('is_admin').eq('id', id).maybeSingle()
        if ((cur?.is_admin ?? false) !== patch.is_admin) {
          return res.status(403).json({ error: 'only a super admin can change admin access' })
        }
      }
      if (patch.is_admin === false && id === ctx.user.id) {
        return res.status(400).json({ error: 'you cannot remove your own admin access' })
      }

      const { data: before, error: beforeErr } = await ctx.supabase
        .from('profiles')
        .select('id, username, display_name, is_admin')
        .eq('id', id)
        .maybeSingle()
      if (beforeErr) return res.status(500).json({ error: beforeErr.message })

      // If profile doesn't exist, create it first (user may exist in auth.users but not profiles)
      let after = before
      if (Object.keys(patch).length === 0) {
        if (!before) return res.status(404).json({ error: 'profile not found' })
      } else if (!before) {
        const { data: inserted, error: insertErr } = await ctx.supabase
          .from('profiles')
          .insert({ id, ...patch })
          .select('id, username, display_name, is_admin')
          .single()
        if (insertErr) return res.status(500).json({ error: insertErr.message })
        after = inserted
      } else {
        const { data: updated, error: updateErr } = await ctx.supabase
          .from('profiles')
          .update(patch)
          .eq('id', id)
          .select('id, username, display_name, is_admin')
          .single()
        if (updateErr) return res.status(500).json({ error: updateErr.message })
        after = updated
      }

      if (Object.keys(patch).length > 0) {
        await logAudit(ctx, {
          action: 'update_profile',
          target_type: 'profile',
          target_id: id,
          before,
          after,
        })
      }

      let granted: string[] | undefined
      if (features) {
        const { data: current, error: curErr } = await ctx.supabase
          .from('feature_access').select('feature').eq('user_id', id)
        if (curErr) return res.status(500).json({ error: curErr.message })
        const had = (current ?? []).map(r => r.feature as string)
        const add = features.filter(f => !had.includes(f))
        const remove = had.filter(f => !features!.includes(f))
        if (add.length) {
          const { error } = await ctx.supabase.from('feature_access')
            .insert(add.map(feature => ({ user_id: id, feature, granted_by: ctx.user.id })))
          if (error) return res.status(500).json({ error: error.message })
        }
        if (remove.length) {
          const { error } = await ctx.supabase.from('feature_access')
            .delete().eq('user_id', id).in('feature', remove)
          if (error) return res.status(500).json({ error: error.message })
        }
        if (add.length || remove.length) {
          await logAudit(ctx, {
            action: 'update_features',
            target_type: 'profile',
            target_id: id,
            before: { features: had },
            after: { features },
          })
        }
        granted = features
      }

      return res.status(200).json({ profile: after, features: granted })
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
    .select('id, username, display_name, is_admin, accent_color, created_at')
    .in('id', ids)
  if (profilesErr) return res.status(500).json({ error: profilesErr.message })

  const { data: grants, error: grantsErr } = await ctx.supabase
    .from('feature_access')
    .select('user_id, feature')
    .in('user_id', ids)
  if (grantsErr) return res.status(500).json({ error: grantsErr.message })
  const featuresById = new Map<string, string[]>()
  for (const g of grants ?? []) {
    featuresById.set(g.user_id, [...(featuresById.get(g.user_id) ?? []), g.feature])
  }

  const byId = new Map((profiles ?? []).map(p => [p.id, p]))
  const merged = usersData.users.map(u => {
    const p = byId.get(u.id)
    return {
      id: u.id,
      email: u.email ?? null,
      username: p?.username ?? null,
      display_name: p?.display_name ?? null,
      is_admin: p?.is_admin ?? false,
      accent_color: p?.accent_color ?? null,
      features: featuresById.get(u.id) ?? [],
      created_at: u.created_at,
      last_sign_in: u.last_sign_in_at ?? null,
    }
  })

  return res.status(200).json({ users: merged })
}
