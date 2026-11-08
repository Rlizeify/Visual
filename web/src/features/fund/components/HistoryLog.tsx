// Change log: who added, edited or deleted which row, newest first.

import { useEffect, useState } from 'react'
import { loadHistory, type HistoryRow } from '../lib/api'
import type { FundEntry, FundMember } from '../lib/ledger'
import { longDate, signedMoney } from '../lib/format'

function describe(e: Partial<FundEntry> | null): string {
  if (!e?.kind || !e.entry_date) return '—'
  const amt = Number(e.amount ?? 0)
  return `${e.kind} ${signedMoney(e.kind === 'withdrawal' ? -amt : amt)} on ${longDate(e.entry_date)}`
}

export default function HistoryLog({ members, version }: { members: FundMember[]; version: number }) {
  const [rows, setRows] = useState<HistoryRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const names = new Map(members.map(m => [m.user_id, m.label]))

  useEffect(() => {
    let cancelled = false
    loadHistory()
      .then(r => { if (!cancelled) setRows(r) })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed') })
    return () => { cancelled = true }
  }, [version])

  if (error) return <p className="fund-err">{error}</p>
  if (!rows) return <p className="muted">Loading…</p>
  if (!rows.length) return <p className="muted">No changes yet.</p>
  return (
    <ol className="fund-history">
      {rows.map(h => (
        <li key={h.id}>
          <time dateTime={h.at}>{new Date(h.at).toLocaleString()}</time>
          <span>
            <strong>{h.actor ? names.get(h.actor) ?? 'Someone' : 'Import'}</strong>{' '}
            {h.action === 'insert' && <>added {describe(h.after)}</>}
            {h.action === 'delete' && <>deleted {describe(h.before)}</>}
            {h.action === 'update' && <>changed {describe(h.before)} → {describe(h.after)}</>}
          </span>
        </li>
      ))}
    </ol>
  )
}
