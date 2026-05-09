import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY

let _supabase: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!SUPABASE_URL) {
    console.error('[_db] Missing env var: SUPABASE_URL')
    throw new Error('Missing env var: SUPABASE_URL')
  }
  if (!SUPABASE_ANON_KEY) {
    console.error('[_db] Missing env var: SUPABASE_ANON_KEY')
    throw new Error('Missing env var: SUPABASE_ANON_KEY')
  }
  if (!_supabase) {
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  }
  return _supabase
}

// Legacy export for existing code - lazily evaluated
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabase() as unknown as Record<string, unknown>)[prop as string]
  }
})
