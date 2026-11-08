// Unified API dispatcher.
//
// Single Vercel function that routes to handlers under `_handlers/*` by
// reading `?_route=` from the query. The `_route` param is set by
// vercel.json rewrites mapping legacy paths (/api/auth, /api/health, ...)
// onto this entry point. Clients keep calling the legacy URLs; rewrites
// inject `_route` server-side without disturbing client-supplied params
// (e.g. `?action=signin-username`).
//
// Why `_route` and not `?action=` — the existing handlers already use
// `?action=` for sub-routing (signin-username, reset-password, etc.). Reusing `action` would collide; `_route` is a
// synthetic namespace we own.
//
// Per-route auth checks live inside each handler — this dispatcher does
// not inspect Authorization. Adding a global auth check here would break
// public endpoints (presets GET, market-snapshot GET).

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handler as authHandler } from './_handlers/auth.js'
import { handler as healthHandler } from './_handlers/health.js'
import { handler as marketSnapshotHandler } from './_handlers/market-snapshot.js'
import { handler as fundMarketHandler } from './_handlers/fund-market.js'
import { handler as adminUsersHandler } from './_handlers/admin/users.js'
import { handler as adminPresetsHandler } from './_handlers/admin/presets.js'

// Admin routes use a dot-namespaced _route ("admin.users", "admin.presets",
// etc.) so the same dispatcher can fan out to /api/admin/<endpoint>
// rewrites without colliding with top-level routes. Each admin handler
// owns its requireAdmin check internally — the dispatcher does NOT
// pre-validate, because public endpoints like presets GET would break.
function adminDispatch(req: VercelRequest, res: VercelResponse, sub: string) {
  switch (sub) {
    case 'users':
      return adminUsersHandler(req, res)
    case 'presets':
      return adminPresetsHandler(req, res)
    default:
      return res.status(404).json({ error: `Unknown admin route: admin.${sub}` })
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const route = req.query._route as string | undefined

  if (route?.startsWith('admin.')) {
    return adminDispatch(req, res, route.slice('admin.'.length))
  }

  switch (route) {
    case 'auth':
      return authHandler(req, res)
    case 'health':
      return healthHandler(req, res)
    case 'market-snapshot':
      return marketSnapshotHandler(req, res)
    case 'fund-market':
      return fundMarketHandler(req, res)
    default:
      return res.status(404).json({ error: `Unknown route: ${route ?? '(missing)'}` })
  }
}
