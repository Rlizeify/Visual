// ADMIN OAUTH TAB API
//
// Queries the `public.oauth_connections_unified` VIEW (migration
// 20260530000001) which UNIONs per-provider token tables
// (spotify_tokens, obsession_strava_tokens, future Discord / MND).
// Synthetic id format: `${provider}:${user_id}`. DELETE parses the id
// and routes to the correct underlying table.
//
// Adding a provider: extend the view's UNION ALL, add the table name
// to `providerTable` below.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireAdmin, logAudit, methodNotAllowed } from '../_admin.js'

const providerTable: Record<string, string> = {
  spotify: 'spotify_tokens',
  strava: 'obsession_strava_tokens',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ctx = await requireAdmin(req, res)
  if (!ctx) return

  const id = String(req.query.id ?? '')

  if (id && req.method === 'DELETE') {
    const [provider, userId] = id.split(':')
    const table = provider ? providerTable[provider] : undefined
    if (!table || !userId) {
      return res.status(400).json({ error: `unknown connection id "${id}"` })
    }

    const { data: before, error: beforeErr } = await ctx.supabase
      .from(table)
      .select('user_id, scope, expires_at, created_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle()
    if (beforeErr) return res.status(500).json({ error: beforeErr.message })
    if (!before) return res.status(404).json({ error: 'connection not found' })

    const { error: deleteErr } = await ctx.supabase
      .from(table)
      .delete()
      .eq('user_id', userId)
    if (deleteErr) return res.status(500).json({ error: deleteErr.message })

    await logAudit(ctx, {
      action: 'disconnect_oauth',
      target_type: 'oauth_connection',
      target_id: id,
      before: { provider, ...before },
      after: null,
    })

    return res.status(200).json({ ok: true })
  }

  // List connections
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET', 'DELETE'])

  // View has no FK metadata for PostgREST nested join — fetch view rows
  // and profiles separately, then join in JS.
  const { data: viewRows, error } = await ctx.supabase
    .from('oauth_connections_unified')
    .select('id, user_id, provider, scope, expires_at, created_at, updated_at')
    .order('updated_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })

  const ids = Array.from(new Set((viewRows ?? []).map(r => r.user_id)))
  const profileById = new Map<string, { username: string | null; display_name: string | null }>()
  const emailById = new Map<string, string | null>()

  if (ids.length > 0) {
    const { data: profiles } = await ctx.supabase
      .from('profiles')
      .select('id, username, display_name')
      .in('id', ids)
    for (const p of profiles ?? []) {
      profileById.set(p.id, { username: p.username ?? null, display_name: p.display_name ?? null })
    }

    const { data: usersData } = await ctx.supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
    for (const u of usersData?.users ?? []) {
      if (ids.includes(u.id)) emailById.set(u.id, u.email ?? null)
    }
  }

  const rows = (viewRows ?? []).map(r => {
    const prof = profileById.get(r.user_id)
    return {
      id: r.id,
      user_id: r.user_id,
      email: emailById.get(r.user_id) ?? null,
      username: prof?.username ?? null,
      display_name: prof?.display_name ?? null,
      provider: r.provider,
      expires_at: r.expires_at,
      scope: r.scope,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }
  })

  return res.status(200).json({ connections: rows })
}
