// Cron dispatcher.
//
// Single entry point for all scheduled jobs. Vercel cron config in
// vercel.json points at /api/cron?job=<name>; this file fans out to
// handlers under _handlers/cron/*.
//
// CRON_SECRET is enforced HERE so every job shares the same gate —
// individual handlers assume the request has already been authorized.
// Vercel cron sends Authorization: Bearer ${CRON_SECRET} automatically.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handler as recomputeHandler } from './_handlers/cron/recompute.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = req.headers['authorization']
  const expectedSecret = process.env.CRON_SECRET
  if (process.env.NODE_ENV === 'production' && expectedSecret && cronSecret !== `Bearer ${expectedSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const job = req.query.job as string | undefined

  switch (job) {
    case 'recompute':
      return recomputeHandler(req, res)
    default:
      return res.status(404).json({ error: `Unknown cron job: ${job ?? '(missing)'}` })
  }
}
