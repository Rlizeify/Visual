import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Super-admin emails (comma-separated). Used only by /api/admin/set-password
// to gate the destructive force-set flow. Reads from env var with fallback.
// See decisions/admin-bootstrap.md and decisions/admin-data-console.md.
const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || 'stone.gaunce@gmail.com')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)

let _service: SupabaseClient | null = null
function service(): SupabaseClient {
  if (_service) return _service
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing — set them in Vercel env')
  }
  _service = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return _service
}

export interface AdminContext {
  supabase: SupabaseClient
  user: { id: string; email: string }
  isSuperAdmin: boolean
}

/**
 * Verifies the caller's Supabase JWT, confirms they're an admin, and returns
 * a context with a service-role-keyed Supabase client + caller identity.
 *
 * On failure: writes an HTTP error and returns null. Callers must `return`
 * after a null result so they don't write a second response.
 */
export async function requireAdmin(
  req: VercelRequest,
  res: VercelResponse,
): Promise<AdminContext | null> {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'missing bearer token' })
    return null
  }
  const token = auth.slice(7)

  let sb: SupabaseClient
  try {
    sb = service()
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
    return null
  }

  // Validate the JWT by asking Supabase auth — also returns the user.
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data?.user) {
    res.status(401).json({ error: 'invalid token' })
    return null
  }
  const user = data.user

  const { data: profile, error: profileErr } = await sb
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()
  if (profileErr) {
    res.status(500).json({ error: profileErr.message })
    return null
  }
  if (!profile?.is_admin) {
    res.status(403).json({ error: 'forbidden' })
    return null
  }

  return {
    supabase: sb,
    user: { id: user.id, email: user.email ?? '' },
    isSuperAdmin: SUPER_ADMIN_EMAILS.includes((user.email ?? '').toLowerCase()),
  }
}

/**
 * Insert a row into audit_log. Best-effort — failures log to console but do
 * not abort the calling request. The user-visible action already succeeded
 * by the time we get here, so failing the request would be more surprising
 * than a missing audit row.
 */
export async function logAudit(
  ctx: AdminContext,
  args: {
    action: string
    target_type: string
    target_id?: string | null
    before?: unknown
    after?: unknown
  },
): Promise<void> {
  const { error } = await ctx.supabase.from('audit_log').insert({
    admin_id: ctx.user.id,
    action: args.action,
    target_type: args.target_type,
    target_id: args.target_id ?? null,
    before: args.before ?? null,
    after: args.after ?? null,
  })
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[audit_log] failed to record:', error.message, args)
  }
}

export function methodNotAllowed(res: VercelResponse, allowed: string[]) {
  res.setHeader('Allow', allowed.join(', '))
  return res.status(405).json({ error: 'method not allowed' })
}
