// The shared spreadsheet: every row with the running balance and each
// member's capital account. Newest first.

import type { Ledger, FundEntry, FundMember } from '../lib/ledger'
import { longDate, money, signedMoney, signedPct } from '../lib/format'

interface Props {
  ledger: Ledger
  members: FundMember[]
  onEdit: (e: FundEntry) => void
  onDelete: (e: FundEntry) => void
}

const KIND_LABEL = { gain: 'Gain / loss', deposit: 'Deposit', withdrawal: 'Withdrawal' } as const

export default function LedgerTable({ ledger, members, onEdit, onDelete }: Props) {
  const rows = [...ledger.rows].reverse()
  if (!rows.length) return <p className="muted">No rows yet.</p>
  return (
    <div className="table-wrap fund-ledger">
      <table className="table table--stack">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Type</th>
            <th scope="col" className="num">Amount</th>
            <th scope="col" className="num">Return</th>
            <th scope="col" className="num">Balance</th>
            {members.map(m => <th key={m.user_id} scope="col" className="num">{m.label}</th>)}
            <th scope="col">Note</th>
            <th scope="col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const e = r.entry
            const signed = e.kind === 'withdrawal' ? -e.amount : e.amount
            return (
              <tr key={e.id} className={`fund-ledger__${e.kind}`}>
                <td data-label="Date">{longDate(e.entry_date)}</td>
                <td data-label="Type">
                  {KIND_LABEL[e.kind]}
                  {e.split && <span className="fund-tag" title="Custom split">custom split</span>}
                </td>
                <td data-label="Amount" className={`num ${signed < 0 ? 'neg' : 'pos'}`}>{signedMoney(signed)}</td>
                <td data-label="Return" className={`num ${(r.pct ?? 0) < 0 ? 'neg' : ''}`}>{r.pct === null ? '—' : signedPct(r.pct)}</td>
                <td data-label="Balance" className="num strong">{money(r.balance)}</td>
                {members.map(m => (
                  <td key={m.user_id} data-label={m.label} className="num">
                    {money(r.memberBalance[m.user_id] ?? 0)}
                    <small className="muted"> {signedMoney(r.delta[m.user_id] ?? 0)}</small>
                  </td>
                ))}
                <td data-label="Note" className="fund-ledger__note">{e.note ?? ''}</td>
                <td data-label="Actions" className="fund-ledger__actions">
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => onEdit(e)}
                    aria-label={`Edit ${KIND_LABEL[e.kind]} on ${longDate(e.entry_date)}`}>Edit</button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => onDelete(e)}
                    aria-label={`Delete ${KIND_LABEL[e.kind]} on ${longDate(e.entry_date)}`}>Delete</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
