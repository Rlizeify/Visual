// OAuth API
// Routes:
//   GET  ?provider=discord                     - start Discord OAuth flow
//   GET  ?provider=discord&callback=true       - Discord callback
//   POST ?provider=mynetdiary                  - submit API key (encrypted)
//   GET  ?action=connections                   - list current user's connections (auth)
//   POST ?action=disconnect&provider=X         - delete an oauth_connections row (auth)
//   POST ?action=connect&provider=spotify      - store spotify tokens after client OAuth (auth)

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

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

// AES-256-GCM helpers. Key = SHA-256 of MYNETDIARY_ENCRYPTION_KEY or JWT_SECRET.
function getEncryptionKey(): Buffer {
  const secret = process.env.MYNETDIARY_ENCRYPTION_KEY || process.env.JWT_SECRET
  if (!secret) throw new Error('Missing MYNETDIARY_ENCRYPTION_KEY or JWT_SECRET')
  return createHash('sha256').update(secret).digest()
}

function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `gcm:${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`
}

// Decrypt left available for future server-side use of stored tokens.
export function decryptSecret(payload: string): string {
  const parts = payload.split(':')
  if (parts.length !== 4 || parts[0] !== 'gcm') throw new Error('bad ciphertext')
  const iv = Buffer.from(parts[1], 'base64')
  const tag = Buffer.from(parts[2], 'base64')
  const data = Buffer.from(parts[3], 'base64')
  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(data), decipher.final()])
  return dec.toString('utf8')
}

async function getUserId(req: VercelRequest, supabase: ReturnType<typeof getServiceSupabase>): Promise<string | null> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const { data } = await supabase.auth.getUser(token)
  return data?.user?.id ?? null
}

// ---------------------------------------------------------------------------
// Discord
// ---------------------------------------------------------------------------

async function handleDiscordStart(req: VercelRequest, res: VercelResponse) {
  if (!DISCORD_CLIENT_ID) {
    return res.status(500).json({ error: 'Discord OAuth not configured' })
  }
  // Caller may pass a Supabase JWT in the query so the callback can persist it.
  const sessionToken = typeof req.query.session === 'string' ? req.query.session : ''
  const state = randomBytes(16).toString('hex')
  const stateData = `${state}.${sessionToken}`

  res.setHeader('Set-Cookie', `discord_oauth_state=${encodeURIComponent(stateData)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`)

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify email',
    state,
  })
  return res.redirect(302, `${DISCORD_AUTH_URL}?${params.toString()}`)
}

async function handleDiscordCallback(req: VercelRequest, res: VercelResponse) {
  const { code, state, error } = req.query
  if (error) return res.redirect(302, '/e?error=discord_denied')
  if (!code || typeof code !== 'string') return res.redirect(302, '/e?error=discord_no_code')

  const cookies = req.headers.cookie || ''
  const stateCookie = cookies.split(';').find(c => c.trim().startsWith('discord_oauth_state='))
  const stored = stateCookie ? decodeURIComponent(stateCookie.split('=')[1] || '') : ''
  const [savedState, sessionToken] = stored.split('.')

  if (!savedState || savedState !== state) {
    return res.redirect(302, '/e?error=discord_state_mismatch')
  }

  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    return res.redirect(302, '/e?error=discord_not_configured')
  }

  try {
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

    const tokens = await tokenRes.json() as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string }

    const userRes = await fetch(DISCORD_USER_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    if (!userRes.ok) return res.redirect(302, '/e?error=discord_user_failed')
    const discordUser = await userRes.json() as { id: string; username: string }

    // Persist the connection if we have a session token.
    if (sessionToken) {
      const supabase = getServiceSupabase()
      const { data: userData } = await supabase.auth.getUser(sessionToken)
      const userId = userData?.user?.id
      if (userId) {
        const expiresAt = tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : null
        await supabase.from('oauth_connections').upsert({
          user_id: userId,
          provider: 'discord',
          access_token_encrypted: encryptSecret(tokens.access_token),
          refresh_token_encrypted: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : null,
          expires_at: expiresAt,
          scope: tokens.scope ?? 'identify email',
          provider_user_id: discordUser.id,
        }, { onConflict: 'user_id,provider' })
      }
    }

    res.setHeader('Set-Cookie', 'discord_oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0')
    return res.redirect(302, '/e?discord_connected=1')
  } catch (err) {
    console.error('[Discord OAuth] Error:', err)
    return res.redirect(302, '/e?error=discord_error')
  }
}

// ---------------------------------------------------------------------------
// MyNetDiary
// ---------------------------------------------------------------------------

async function handleMyNetDiarySubmit(req: VercelRequest, res: VercelResponse) {
  const supabase = getServiceSupabase()
  const userId = await getUserId(req, supabase)
  if (!userId) return res.status(401).json({ error: 'Auth required' })

  const { api_key } = (req.body ?? {}) as { api_key?: string }
  if (!api_key || typeof api_key !== 'string' || api_key.length < 8) {
    return res.status(400).json({ error: 'API key required' })
  }

  // Validate by hitting MyNet Diary. Their API is not well-documented publicly;
  // we issue a cheap profile call and accept any non-4xx response as "looks valid".
  try {
    const testRes = await fetch('https://api.mynetdiary.com/v1/user/profile', {
      headers: { Authorization: `Bearer ${api_key}`, Accept: 'application/json' },
    })
    if (testRes.status === 401 || testRes.status === 403) {
      return res.status(400).json({ error: 'Invalid MyNet Diary API key' })
    }
    // Other statuses (200, 404, 5xx) are accepted — endpoint shape can vary.
  } catch (err) {
    console.warn('[MyNetDiary] validation reached network error, accepting:', err)
  }

  const { error: upsertError } = await supabase
    .from('oauth_connections')
    .upsert({
      user_id: userId,
      provider: 'mynetdiary',
      access_token_encrypted: encryptSecret(api_key),
      refresh_token_encrypted: null,
      expires_at: null,
      scope: 'api_key',
    }, { onConflict: 'user_id,provider' })

  if (upsertError) {
    console.error('[MyNetDiary] Failed to store connection:', upsertError)
    return res.status(500).json({ error: 'Failed to store connection' })
  }

  return res.status(200).json({ ok: true })
}

// ---------------------------------------------------------------------------
// Generic connection management
// ---------------------------------------------------------------------------

async function handleConnectionsList(req: VercelRequest, res: VercelResponse) {
  const supabase = getServiceSupabase()
  const userId = await getUserId(req, supabase)
  if (!userId) return res.status(401).json({ error: 'Auth required' })

  const services = ['spotify', 'discord', 'mynetdiary', 'apple'] as const
  const { data } = await supabase
    .from('oauth_connections')
    .select('provider, created_at, updated_at')
    .eq('user_id', userId)

  const byProvider = new Map((data ?? []).map(r => [r.provider, r]))

  const result = services.map(service => {
    const row = byProvider.get(service)
    return {
      service,
      connected: !!row,
      connected_at: row?.created_at ?? null,
    }
  })

  return res.status(200).json({ connections: result })
}

async function handleDisconnect(req: VercelRequest, res: VercelResponse) {
  const supabase = getServiceSupabase()
  const userId = await getUserId(req, supabase)
  if (!userId) return res.status(401).json({ error: 'Auth required' })

  const provider = req.query.provider as string | undefined
  if (!provider) return res.status(400).json({ error: 'provider required' })

  const { error } = await supabase
    .from('oauth_connections')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}

async function handleSpotifyConnect(req: VercelRequest, res: VercelResponse) {
  const supabase = getServiceSupabase()
  const userId = await getUserId(req, supabase)
  if (!userId) return res.status(401).json({ error: 'Auth required' })

  const { access_token, refresh_token, expires_in } = (req.body ?? {}) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
  }
  if (!access_token) return res.status(400).json({ error: 'access_token required' })

  // Best-effort fetch Spotify identity for provider_user_id.
  let providerUserId: string | null = null
  try {
    const me = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    if (me.ok) {
      const body = await me.json() as { id?: string }
      providerUserId = body.id ?? null
    }
  } catch {
    // Non-fatal
  }

  const expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null

  const { error } = await supabase.from('oauth_connections').upsert({
    user_id: userId,
    provider: 'spotify',
    access_token_encrypted: encryptSecret(access_token),
    refresh_token_encrypted: refresh_token ? encryptSecret(refresh_token) : null,
    expires_at: expiresAt,
    scope: 'spotify-client',
    provider_user_id: providerUserId,
  }, { onConflict: 'user_id,provider' })

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true, provider_user_id: providerUserId })
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const provider = req.query.provider as string | undefined
  const action = req.query.action as string | undefined
  const isCallback = req.query.callback === 'true'

  // Generic actions
  if (req.method === 'GET' && action === 'connections') return handleConnectionsList(req, res)
  if (req.method === 'POST' && action === 'disconnect') return handleDisconnect(req, res)
  if (req.method === 'POST' && action === 'connect' && provider === 'spotify') return handleSpotifyConnect(req, res)

  if (provider === 'discord') {
    if (isCallback || req.query.code) return handleDiscordCallback(req, res)
    return handleDiscordStart(req, res)
  }

  if (provider === 'mynetdiary') {
    if (req.method === 'POST') return handleMyNetDiarySubmit(req, res)
    return res.status(405).json({ error: 'POST your api_key' })
  }

  return res.status(400).json({ error: 'Unknown route' })
}
