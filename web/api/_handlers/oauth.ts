// OAuth handler — Strava only (used by Obsession → Training).
// Dispatched from /api/index when ?_route=oauth.
// Routes:
//   GET  ?provider=strava&session=<jwt>        - start Strava OAuth
//   GET  ?provider=strava&callback=true        - Strava callback (writes obsession_strava_tokens)
//   POST ?action=strava-sync                   - pull recent activities for current user
//
// Discord, MyNetDiary API-key, oauth_connections list/disconnect and the
// Spotify-connect action were removed with Life Scores (2026-11-03).

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET
const STRAVA_REDIRECT_URI = process.env.STRAVA_REDIRECT_URI || (
  process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}/api/oauth?provider=strava&callback=true`
    : 'http://localhost:3000/api/oauth?provider=strava&callback=true'
)
const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize'
const STRAVA_TOKEN_URL = 'https://www.strava.com/api/v3/oauth/token'
const STRAVA_ACTIVITIES_URL = 'https://www.strava.com/api/v3/athlete/activities'

function getServiceSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase config')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function getUserId(req: VercelRequest, supabase: ReturnType<typeof getServiceSupabase>): Promise<string | null> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const { data } = await supabase.auth.getUser(token)
  return data?.user?.id ?? null
}

// ---------------------------------------------------------------------------
// Strava (Obsession)
// ---------------------------------------------------------------------------

async function handleStravaStart(req: VercelRequest, res: VercelResponse) {
  if (!STRAVA_CLIENT_ID) return res.status(500).json({ error: 'Strava OAuth not configured' })

  const sessionToken = typeof req.query.session === 'string' ? req.query.session : ''
  const state = randomBytes(16).toString('hex')
  const stateData = `${state}.${sessionToken}`

  res.setHeader('Set-Cookie', `strava_oauth_state=${encodeURIComponent(stateData)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`)

  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: STRAVA_REDIRECT_URI,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'read,activity:read',
    state,
  })
  return res.redirect(302, `${STRAVA_AUTH_URL}?${params.toString()}`)
}

async function handleStravaCallback(req: VercelRequest, res: VercelResponse) {
  const { code, state, error } = req.query
  if (error) return res.redirect(302, '/obsession/training?error=strava_denied')
  if (!code || typeof code !== 'string') return res.redirect(302, '/obsession/training?error=strava_no_code')

  const cookies = req.headers.cookie || ''
  const stateCookie = cookies.split(';').find(c => c.trim().startsWith('strava_oauth_state='))
  const stored = stateCookie ? decodeURIComponent(stateCookie.split('=')[1] || '') : ''
  const [savedState, sessionToken] = stored.split('.')
  if (!savedState || savedState !== state) {
    return res.redirect(302, '/obsession/training?error=strava_state_mismatch')
  }
  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
    return res.redirect(302, '/obsession/training?error=strava_not_configured')
  }

  try {
    const tokenRes = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    })
    if (!tokenRes.ok) {
      console.error('[Strava OAuth] Token exchange failed:', await tokenRes.text())
      return res.redirect(302, '/obsession/training?error=strava_token_failed')
    }
    const tokens = await tokenRes.json() as {
      access_token: string
      refresh_token: string
      expires_at: number
      athlete?: { id?: number }
    }

    if (sessionToken) {
      const supabase = getServiceSupabase()
      const { data: userData } = await supabase.auth.getUser(sessionToken)
      const userId = userData?.user?.id
      if (userId) {
        // Schema stores tokens in plain text columns; row is RLS-locked
        // per-user and only readable by the user or the service role.
        await supabase.from('obsession_strava_tokens').upsert({
          user_id: userId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: new Date(tokens.expires_at * 1000).toISOString(),
          scope: 'read,activity:read',
          athlete_id: tokens.athlete?.id ?? null,
        }, { onConflict: 'user_id' })
      }
    }

    res.setHeader('Set-Cookie', 'strava_oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0')
    return res.redirect(302, '/obsession/training?strava_connected=1')
  } catch (err) {
    console.error('[Strava OAuth] Error:', err)
    return res.redirect(302, '/obsession/training?error=strava_error')
  }
}

// Refresh the Strava access token if it's expired, then pull recent
// activities and upsert into obsession_strava_activities.
async function handleStravaSync(req: VercelRequest, res: VercelResponse) {
  const supabase = getServiceSupabase()
  const userId = await getUserId(req, supabase)
  if (!userId) return res.status(401).json({ error: 'Auth required' })
  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) return res.status(500).json({ error: 'Strava OAuth not configured' })

  const { data: tokenRow } = await supabase
    .from('obsession_strava_tokens')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (!tokenRow) return res.status(400).json({ error: 'Strava not connected' })

  let accessToken = tokenRow.access_token as string
  const refreshToken = tokenRow.refresh_token as string
  const expiresAt = tokenRow.expires_at ? new Date(tokenRow.expires_at).getTime() : 0

  if (Date.now() > expiresAt - 60_000) {
    const refreshRes = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })
    if (!refreshRes.ok) {
      return res.status(401).json({ error: 'Strava token refresh failed' })
    }
    const refreshed = await refreshRes.json() as {
      access_token: string
      refresh_token: string
      expires_at: number
    }
    accessToken = refreshed.access_token
    await supabase.from('obsession_strava_tokens').update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
    }).eq('user_id', userId)
  }

  // Pull last 90 days (max 200 per page).
  const after = Math.floor((Date.now() - 90 * 86400_000) / 1000)
  const url = `${STRAVA_ACTIVITIES_URL}?after=${after}&per_page=200`
  const actsRes = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!actsRes.ok) {
    return res.status(502).json({ error: 'Strava activities fetch failed' })
  }
  const acts = await actsRes.json() as Array<Record<string, unknown> & {
    id: number
    type: string
    distance: number
    moving_time: number
    elapsed_time: number
    start_date: string
  }>

  const rows = acts.map(a => ({
    user_id: userId,
    strava_id: a.id,
    type: a.type,
    distance: a.distance,
    moving_time: a.moving_time,
    elapsed_time: a.elapsed_time,
    started_at: a.start_date,
    raw_payload: a,
  }))

  if (rows.length > 0) {
    const { error: upErr } = await supabase
      .from('obsession_strava_activities')
      .upsert(rows, { onConflict: 'strava_id' })
    if (upErr) {
      console.error('[Strava sync] upsert failed:', upErr)
      return res.status(500).json({ error: upErr.message })
    }
  }

  return res.status(200).json({ ok: true, count: rows.length })
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export async function handler(req: VercelRequest, res: VercelResponse) {
  const provider = req.query.provider as string | undefined
  const action = req.query.action as string | undefined
  const isCallback = req.query.callback === 'true'

  if (req.method === 'POST' && action === 'strava-sync') return handleStravaSync(req, res)

  if (provider === 'strava') {
    if (isCallback || req.query.code) return handleStravaCallback(req, res)
    return handleStravaStart(req, res)
  }

  return res.status(400).json({ error: 'Unknown route' })
}
