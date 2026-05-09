// Discord OAuth2 flow
// Scopes: identify, email

import type { VercelRequest, VercelResponse } from '@vercel/node'

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || (
  process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}/api/oauth/discord/callback`
    : 'http://localhost:3000/api/oauth/discord/callback'
)

const DISCORD_AUTH_URL = 'https://discord.com/api/oauth2/authorize'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  if (!DISCORD_CLIENT_ID) {
    return res.status(500).json({ error: 'Discord OAuth not configured: DISCORD_CLIENT_ID missing' })
  }

  // Build authorization URL
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
