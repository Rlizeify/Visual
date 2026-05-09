import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY

  if (!url) {
    console.error('[_db] Missing env var: SUPABASE_URL')
    throw new Error('Missing env var: SUPABASE_URL')
  }
  if (!key) {
    console.error('[_db] Missing env var: SUPABASE_ANON_KEY')
    throw new Error('Missing env var: SUPABASE_ANON_KEY')
  }

  _supabase = createClient(url, key)
  return _supabase
}

// Legacy export for existing code - lazily evaluated
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabase() as unknown as Record<string, unknown>)[prop as string]
  }
})
