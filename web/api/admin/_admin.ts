import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

let _adminSupabase: SupabaseClient | null = null

export function getAdminSupabase(): SupabaseClient {
  if (!SUPABASE_URL) {
    console.error('[_admin] Missing env var: SUPABASE_URL')
    throw new Error('Missing env var: SUPABASE_URL')
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[_admin] Missing env var: SUPABASE_SERVICE_ROLE_KEY')
    throw new Error('Missing env var: SUPABASE_SERVICE_ROLE_KEY')
  }
  if (!_adminSupabase) {
    _adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  }
  return _adminSupabase
}

export async function requireAdmin(
  req: VercelRequest,
  res: VercelResponse
): Promise<{ userId: string } | null> {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' })
    return null
  }

  const token = auth.slice(7)

  let supabase: SupabaseClient
  try {
    supabase = getAdminSupabase()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Admin database configuration error'
    console.error('[_admin] ' + msg)
    res.status(500).json({ error: msg })
    return null
  }

  // Verify the token with Supabase
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    res.status(401).json({ error: 'Invalid token' })
    return null
  }

  // Check if user is admin
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.is_admin) {
    res.status(403).json({ error: 'Admin access required' })
    return null
  }

  return { userId: user.id }
}
