import type { VercelRequest, VercelResponse } from '@vercel/node'

const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET',
] as const

export function handler(_req: VercelRequest, res: VercelResponse) {
  const status: Record<string, boolean> = {}
  let allPresent = true

  for (const varName of REQUIRED_ENV_VARS) {
    const present = !!process.env[varName]
    status[varName] = present
    if (!present) allPresent = false
  }

  return res.status(allPresent ? 200 : 503).json({
    ok: allPresent,
    env: status,
    timestamp: new Date().toISOString(),
  })
}
