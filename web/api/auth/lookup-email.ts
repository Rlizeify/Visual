// API endpoint to lookup email by username for login
// This allows users to sign in with their username instead of email

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

function getServiceSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { username } = req.body as { username?: string }
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Username required' })
  }

  let supabase
  try {
    supabase = getServiceSupabase()
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }

  // Look up profile by username
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username.toLowerCase())
    .maybeSingle()

  if (profileError) {
    return res.status(500).json({ error: profileError.message })
  }

  if (!profile) {
    return res.status(404).json({ error: 'Username not found' })
  }

  // Get email from auth.users using service role
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(profile.id)

  if (userError || !userData?.user?.email) {
    return res.status(404).json({ error: 'User not found' })
  }

  return res.status(200).json({ email: userData.user.email })
}
