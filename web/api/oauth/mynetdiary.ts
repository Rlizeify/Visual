// MyNet Diary API key flow
// MyNet Diary does not have a public OAuth API - they use API key authentication
// This endpoint handles API key submission and validation

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

function getServiceSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase config')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    // Return info about the API key flow
    return res.status(200).json({
      type: 'api_key',
      message: 'MyNet Diary uses API key authentication, not OAuth. Submit your API key to connect.',
      instructions: 'Find your API key in MyNet Diary settings under "Developer" or "API Access".',
      note: 'MyNet Diary may require a premium subscription for API access.',
    })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Handle API key submission
  const { api_key, user_id } = req.body as { api_key?: string; user_id?: string }

  if (!api_key || typeof api_key !== 'string') {
    return res.status(400).json({ error: 'API key required' })
  }

  if (!user_id || typeof user_id !== 'string') {
    return res.status(400).json({ error: 'User ID required' })
  }

  try {
    // Validate the API key by making a test request to MyNet Diary
    // Note: This is a placeholder - actual endpoint depends on MyNet Diary's API
    // Their API documentation should specify the correct endpoint
    const testRes = await fetch('https://api.mynetdiary.com/v1/user/profile', {
      headers: {
        'Authorization': `Bearer ${api_key}`,
        'Accept': 'application/json',
      },
    })

    if (!testRes.ok) {
      // If the API doesn't exist or key is invalid
      if (testRes.status === 401 || testRes.status === 403) {
        return res.status(401).json({ error: 'Invalid API key' })
      }
      // API might not be available
      console.warn('[MyNetDiary] API test failed:', testRes.status)
    }

    // Store the API key as an OAuth connection
    const supabase = getServiceSupabase()

    // Note: In production, encrypt the API key using pgcrypto encrypt_token function
    const { error: upsertError } = await supabase
      .from('oauth_connections')
      .upsert({
        user_id,
        provider: 'mynetdiary',
        access_token_encrypted: api_key, // In production, encrypt this
        refresh_token_encrypted: null,
        expires_at: null, // API keys don't expire
        scope: 'api_key',
      }, {
        onConflict: 'user_id,provider',
      })

    if (upsertError) {
      console.error('[MyNetDiary] Failed to store connection:', upsertError)
      return res.status(500).json({ error: 'Failed to store connection' })
    }

    return res.status(200).json({ success: true, message: 'MyNet Diary connected' })
  } catch (err) {
    console.error('[MyNetDiary] Error:', err)
    return res.status(500).json({ error: 'Connection failed' })
  }
}
