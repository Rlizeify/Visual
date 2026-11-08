// Casino chip requests — super admins only.
//   GET   recent requests (pending first) with usernames and balances
//   POST  { id, approve, amount? }  approve (credits `amount`, default the
//         requested amount) or deny, in one casino_decide_request() call.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { logAudit, methodNotAllowed, requireAdmin } from '../../_admin.js'

export async function handler(req: VercelRequest, res: VercelResponse) {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  if (!admin.isSuperAdmin) return res.status(403).json({ error: 'super admin only' })
  const sb = admin.supabase

  if (req.method === 'GET') {
    const { data, error } = await sb.from('casino_chip_requests')
      .select('id, user_id, amount, note, status, granted, created_at, decided_at')
      .order('created_at', { ascending: false }).limit(200)
    if (error) return res.status(500).json({ error: error.message })
    const ids = [...new Set((data ?? []).map(r => r.user_id as string))]
    const [p, w] = await Promise.all([
      sb.from('profiles').select('id, username').in('id', ids),
      sb.from('casino_wallets').select('user_id, chips').in('user_id', ids),
    ])
    const names = new Map((p.data ?? []).map(r => [r.id as string, r.username as string]))
    const chips = new Map((w.data ?? []).map(r => [r.user_id as string, Number(r.chips)]))
    const rows = (data ?? []).map(r => ({
      ...r, amount: Number(r.amount), granted: r.granted === null ? null : Number(r.granted),
      username: names.get(r.user_id as string) ?? '—', chips: chips.get(r.user_id as string) ?? 0,
    }))
    rows.sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending'))
    return res.status(200).json({ requests: rows })
  }

  if (req.method === 'POST') {
    const { id, approve, amount } = (req.body ?? {}) as { id?: unknown; approve?: unknown; amount?: unknown }
    if (typeof id !== 'string' || typeof approve !== 'boolean') {
      return res.status(400).json({ error: 'id and approve are required' })
    }
    let grant: number | null = null
    if (approve) {
      if (amount !== undefined && (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0)) {
        return res.status(400).json({ error: 'amount must be a positive whole number' })
      }
      if (typeof amount === 'number') grant = amount
      else {
        const { data } = await sb.from('casino_chip_requests').select('amount').eq('id', id).maybeSingle()
        grant = data ? Number(data.amount) : null
      }
    }
    const { data, error } = await sb.rpc('casino_decide_request', {
      p_id: id, p_approve: approve, p_amount: grant, p_admin: admin.user.id,
    })
    if (error) return res.status(400).json({ error: error.message })
    await logAudit(admin, { action: approve ? 'casino.approve' : 'casino.deny', target_type: 'casino_chip_request', target_id: id, after: data })
    return res.status(200).json({ request: data })
  }

  return methodNotAllowed(res, ['GET', 'POST'])
}
