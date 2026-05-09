import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyToken } from './_jwt.js'

export function getSpotifyId(req: VercelRequest, res: VercelResponse): string | null {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' })
    return null
  }
  try {
    const payload = verifyToken(auth.slice(7)) as { spotify_id: string }
    return payload.spotify_id
  } catch {
    res.status(401).json({ error: 'Invalid token' })
    return null
  }
}
