// Admin → Chips: players' requests for more casino chips. Super admins
// approve (optionally changing the amount) or deny; /api/admin/casino
// re-checks the role and credits the wallet in one transaction.

import { useCallback, useEffect, useState } from 'react'
import { adminGet, adminPost } from '../../lib/adminApi'

interface Row {
  id: string
  username: string
  chips: number
  amount: number
  note: string | null
  status: 'pending' | 'approved' | 'denied'
  granted: number | null
  created_at: string
}

const fmt = (n: number) => n.toLocaleString()

export default function ChipRequestsTab() {
  const [rows, setRows] = useState<Row[]>([])
  const [grant, setGrant] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const out = await adminGet<{ requests: Row[] }>('/api/admin/casino')
      setRows(out.requests)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const decide = async (r: Row, approve: boolean) => {
    setBusy(r.id)
    try {
      await adminPost('/api/admin/casino', { id: r.id, approve, amount: approve ? grant[r.id] ?? r.amount : undefined })
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const pending = rows.filter(r => r.status === 'pending').length

  return (
    <div className="stack">
      <div className="row">
        <p className="muted">{loading ? 'Loading…' : `${pending} waiting · ${rows.length} total`}</p>
        <button type="button" className="btn btn--sm" onClick={load}>Refresh</button>
      </div>
      {error && <p className="alert" role="alert">{error}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Player</th><th>Has</th><th>Asked</th><th>Note</th><th>When</th><th>Decision</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && <tr><td colSpan={6} className="faint">No requests yet.</td></tr>}
            {rows.map(r => (
              <tr key={r.id}>
                <td>{r.username}</td>
                <td>{fmt(r.chips)}</td>
                <td>{fmt(r.amount)}</td>
                <td>{r.note ?? '—'}</td>
                <td>{new Date(r.created_at).toLocaleString()}</td>
                <td>
                  {r.status === 'pending' ? (
                    <div className="row">
                      <label className="sr-only" htmlFor={`grant-${r.id}`}>Chips to grant</label>
                      <input id={`grant-${r.id}`} className="input" type="number" min={1} max={10000000}
                        style={{ width: '9rem' }} value={grant[r.id] ?? r.amount}
                        onChange={e => setGrant(g => ({ ...g, [r.id]: Math.floor(Number(e.target.value)) }))} />
                      <button type="button" className="btn btn--primary btn--sm" disabled={busy === r.id}
                        onClick={() => decide(r, true)}>Approve</button>
                      <button type="button" className="btn btn--danger btn--sm" disabled={busy === r.id}
                        onClick={() => decide(r, false)}>Deny</button>
                    </div>
                  ) : r.status === 'approved' ? `Approved ${fmt(r.granted ?? 0)}` : 'Denied'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
