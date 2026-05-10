// OAuth API (merged discord + discord/callback + mynetdiary)
// Routes:
//   GET ?provider=discord - start Discord OAuth flow
//   GET ?provider=discord&callback=true&code=... - Discord callback
//   GET ?provider=mynetdiary - get API key info
//   POST ?provider=mynetdiary - submit API key

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || (
  process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}/api/oauth?provider=discord&callback=true`
    : 'http://localhost:3000/api/oauth?provider=discord&callback=true'
)

const DISCORD_AUTH_URL = 'https://discord.com/api/oauth2/authorize'
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token'
const DISCORD_USER_URL = 'https://discord.com/api/users/@me'

function getServiceSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase config')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// Discord OAuth start
async function handleDiscordStart(_req: VercelRequest, res: VercelResponse) {
  if (!DISCORD_CLIENT_ID) {
    return res.status(500).json({ error: 'Discord OAuth not configured: DISCORD_CLIENT_ID missing' })
  }

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify email',
  })

  // Store state in session for CSRF protection
  const state = Math.random().toString(36).substring(2)
  res.setHeader('Set-Cookie', `discord_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`)

  params.append('state', state)

  return res.redirect(302, `${DISCORD_AUTH_URL}?${params.toString()}`)
}

// Discord OAuth callback
async function handleDiscordCallback(req: VercelRequest, res: VercelResponse) {
  const { code, state, error } = req.query

  if (error) {
    return res.redirect(302, '/e?error=discord_denied')
  }

  if (!code || typeof code !== 'string') {
    return res.redirect(302, '/e?error=discord_no_code')
  }

  // Verify state
  const cookies = req.headers.cookie || ''
  const stateCookie = cookies.split(';').find(c => c.trim().startsWith('discord_oauth_state='))
  const savedState = stateCookie?.split('=')[1]
  if (!savedState || savedState !== state) {
    return res.redirect(302, '/e?error=discord_state_mismatch')
  }

  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    return res.redirect(302, '/e?error=discord_not_configured')
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch(DISCORD_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
    })

    if (!tokenRes.ok) {
      console.error('[Discord OAuth] Token exchange failed:', await tokenRes.text())
      return res.redirect(302, '/e?error=discord_token_failed')
    }

    const tokens = await tokenRes.json()
    const { access_token } = tokens

    // Get user info
    const userRes = await fetch(DISCORD_USER_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    if (!userRes.ok) {
      return res.redirect(302, '/e?error=discord_user_failed')
    }

    const discordUser = await userRes.json()

    // Clear the state cookie
    res.setHeader('Set-Cookie', 'discord_oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0')

    // Redirect to E tab with success - client will complete the connection
    return res.redirect(302, `/e?discord_connected=true&discord_user=${encodeURIComponent(discordUser.username)}`)
  } catch (err) {
    console.error('[Discord OAuth] Error:', err)
    return res.redirect(302, '/e?error=discord_error')
  }
}

// MyNet Diary info (GET)
async function handleMyNetDiaryInfo(_req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    type: 'api_key',
    message: 'MyNet Diary uses API key authentication, not OAuth. Submit your API key to connect.',
    instructions: 'Find your API key in MyNet Diary settings under "Developer" or "API Access".',
    note: 'MyNet Diary may require a premium subscription for API access.',
  })
}

// MyNet Diary submit API key (POST)
async function handleMyNetDiarySubmit(req: VercelRequest, res: VercelResponse) {
  const { api_key, user_id } = req.body as { api_key?: string; user_id?: string }

  if (!api_key || typeof api_key !== 'string') {
    return res.status(400).json({ error: 'API key required' })
  }

  if (!user_id || typeof user_id !== 'string') {
    return res.status(400).json({ error: 'User ID required' })
  }

  try {
    // Validate the API key by making a test request to MyNet Diary
    const testRes = await fetch('https://api.mynetdiary.com/v1/user/profile', {
      headers: {
        'Authorization': `Bearer ${api_key}`,
        'Accept': 'application/json',
      },
    })

    if (!testRes.ok) {
      if (testRes.status === 401 || testRes.status === 403) {
        return res.status(401).json({ error: 'Invalid API key' })
      }
      console.warn('[MyNetDiary] API test failed:', testRes.status)
    }

    // Store the API key as an OAuth connection
    const supabase = getServiceSupabase()

    const { error: upsertError } = await supabase
      .from('oauth_connections')
      .upsert({
        user_id,
        provider: 'mynetdiary',
        access_token_encrypted: api_key,
        refresh_token_encrypted: null,
        expires_at: null,
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const provider = req.query.provider as string | undefined
  const isCallback = req.query.callback === 'true'

  if (provider === 'discord') {
    if (isCallback || req.query.code) {
      return handleDiscordCallback(req, res)
    }
    return handleDiscordStart(req, res)
  }

  if (provider === 'mynetdiary') {
    if (req.method === 'GET') {
      return handleMyNetDiaryInfo(req, res)
    }
    if (req.method === 'POST') {
      return handleMyNetDiarySubmit(req, res)
    }
    return res.status(405).json({ error: 'Method not allowed' })
  }

  return res.status(400).json({ error: 'Unknown provider. Use ?provider=discord or ?provider=mynetdiary' })
}
