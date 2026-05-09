// Discord OAuth2 callback handler

import type { VercelRequest, VercelResponse } from '@vercel/node'

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || (
  process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}/api/oauth/discord/callback`
    : 'http://localhost:3000/api/oauth/discord/callback'
)

const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token'
const DISCORD_USER_URL = 'https://discord.com/api/users/@me'

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    // Note: In production, you'd validate the user's session and store the connection
    // For now, we redirect with the username - the client will handle the connection storage
    // For now, redirect with tokens in URL fragment (client will handle storage)
    // In production, use secure session handling

    // Clear the state cookie
    res.setHeader('Set-Cookie', 'discord_oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0')

    // Redirect to E tab with success - client will complete the connection
    return res.redirect(302, `/e?discord_connected=true&discord_user=${encodeURIComponent(discordUser.username)}`)
  } catch (err) {
    console.error('[Discord OAuth] Error:', err)
    return res.redirect(302, '/e?error=discord_error')
  }
}
