// Add / edit one ledger row. Gains can be typed in dollars or as a percent
// of the balance they were earned on; deposits and withdrawals split
// equally unless "custom split" is set (percent per member, total 100).

import { useMemo, useState } from 'react'
import { balanceBefore, type EntryKind, type FundEntry, type FundMember } from '../lib/ledger'
import type { EntryDraft } from '../lib/api'
import { money, parseNum, pct } from '../lib/format'

interface Props {
  members: FundMember[]
  entries: FundEntry[]
  initial: FundEntry | null
  defaultDate: string
  saving: boolean
  onSave: (d: EntryDraft) => void
  onCancel: () => void
}

const KINDS: { id: EntryKind; label: string }[] = [
  { id: 'gain', label: 'Gain / loss' },
  { id: 'deposit', label: 'Deposit' },
  { id: 'withdrawal', label: 'Withdrawal' },
]

export default function EntryForm({ members, entries, initial, defaultDate, saving, onSave, onCancel }: Props) {
  const [kind, setKind] = useState<EntryKind>(initial?.kind ?? 'gain')
  const [date, setDate] = useState(initial?.entry_date ?? defaultDate)
  const [unit, setUnit] = useState<'$' | '%'>('$')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [custom, setCustom] = useState(!!initial?.split)
  const [split, setSplit] = useState<Record<string, string>>(() =>
    Object.fromEntries(members.map(m => [m.user_id, String(initial?.split?.[m.user_id] ?? +(100 / members.length).toFixed(2))])))
  const [error, setError] = useState<string | null>(null)

  const base = useMemo(() => balanceBefore(entries.filter(e => e.id !== initial?.id), date), [entries, initial, date])
  const typed = parseNum(amount)
  const dollars = kind === 'gain' && unit === '%' ? Math.round(base * typed) / 100 : typed
  const splitTotal = members.reduce((s, m) => s + (parseNum(split[m.user_id] ?? '') || 0), 0)

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!date) return setError('Pick a date.')
    if (date < '2025-01-01') return setError('The ledger starts on Jan 1, 2025.')
    if (!Number.isFinite(dollars)) return setError('Enter an amount.')
    if (kind !== 'gain' && dollars <= 0) return setError('Deposits and withdrawals are positive amounts.')
    if (kind === 'gain' && unit === '%' && base <= 0) return setError('No balance before this date to take a percent of — enter dollars.')
    if (kind !== 'gain' && custom && Math.abs(splitTotal - 100) > 0.01) return setError(`Split must total 100% (now ${splitTotal.toFixed(2)}%).`)
    setError(null)
    onSave({
      entry_date: date,
      kind,
      amount: Math.round(dollars * 100) / 100,
      note: note.trim() || null,
      split: kind !== 'gain' && custom
        ? Object.fromEntries(members.map(m => [m.user_id, parseNum(split[m.user_id] ?? '') || 0]))
        : null,
    })
  }

  return (
    <form className="fund-form card" onSubmit={submit} aria-label={initial ? 'Edit row' : 'Add row'}>
      <div className="fund-seg" role="radiogroup" aria-label="Row type">
        {KINDS.map(k => (
          <button key={k.id} type="button" role="radio" aria-checked={kind === k.id}
            className={kind === k.id ? 'on' : ''} onClick={() => setKind(k.id)}>{k.label}</button>
        ))}
      </div>

      <div className="fund-form__grid">
        <label className="field">
          <span>Date</span>
          <input className="input" type="date" min="2025-01-01" value={date} onChange={e => setDate(e.target.value)} required />
        </label>

        <label className="field">
          <span>{kind === 'gain' ? (unit === '$' ? 'Gain / loss ($, negative for a loss)' : 'Gain / loss (% of balance)') : 'Amount ($)'}</span>
          <div className="fund-form__amount">
            <input className="input" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder={kind === 'gain' && unit === '%' ? '6.2' : '0.00'} required />
            {kind === 'gain' && (
              <div className="fund-seg fund-seg--sm" role="radiogroup" aria-label="Enter as">
                {(['$', '%'] as const).map(u => (
                  <button key={u} type="button" role="radio" aria-checked={unit === u} className={unit === u ? 'on' : ''}
                    onClick={() => setUnit(u)}>{u}</button>
                ))}
              </div>
            )}
          </div>
          {kind === 'gain' && Number.isFinite(typed) && base > 0 && (
            <small className="muted">
              On {money(base)}: {unit === '%' ? money(dollars) : pct(dollars / base)}
            </small>
          )}
        </label>

        <label className="field fund-form__note">
          <span>Note (optional)</span>
          <input className="input" maxLength={200} value={note} onChange={e => setNote(e.target.value)} />
        </label>
      </div>

      {kind !== 'gain' && (
        <fieldset className="fund-form__split">
          <legend className="label">Split</legend>
          <label className="fund-check">
            <input type="checkbox" checked={!custom} onChange={e => setCustom(!e.target.checked)} />
            Split equally ({members.map(m => m.label).join(' / ')})
          </label>
          {custom && (
            <div className="fund-form__grid">
              {members.map(m => (
                <label key={m.user_id} className="field">
                  <span>{m.label} %</span>
                  <input className="input" inputMode="decimal" value={split[m.user_id] ?? ''}
                    onChange={e => setSplit(s => ({ ...s, [m.user_id]: e.target.value }))} />
                </label>
              ))}
              <p className={Math.abs(splitTotal - 100) > 0.01 ? 'fund-err' : 'muted'}>Total {splitTotal.toFixed(2)}%</p>
            </div>
          )}
        </fieldset>
      )}

      {error && <p className="fund-err" role="alert">{error}</p>}
      <div className="row">
        <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Saving…' : initial ? 'Save changes' : 'Add row'}</button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
