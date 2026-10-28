import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { MarketParams } from '../../../lib/options/index.js'
import { todayISO } from '../../../lib/options/index.js'
import { solveCandidate } from '../lib/model'
import { parseNum, pct } from '../lib/format'
import type { CandidateDraft, CandidateRow } from '../lib/types'

export type FormMode = 'new' | 'edit' | 'duplicate'

interface Props {
  mode: FormMode
  initial: CandidateRow | null
  /** Current effective spot; null if unknown. */
  spot: number | null
  market: MarketParams
  onSubmit: (draft: CandidateDraft, remark: boolean) => Promise<void>
  onCancel: () => void
}

export default function CandidateForm({ mode, initial, spot, market, onSubmit, onCancel }: Props) {
  const [type, setType] = useState<'call' | 'put'>(initial?.type ?? 'call')
  const [strike, setStrike] = useState(initial ? String(initial.strike) : '')
  const [expiry, setExpiry] = useState(initial?.expiry ?? '')
  const [premium, setPremium] = useState(mode === 'edit' && initial ? String(initial.premium) : '')
  const [contracts, setContracts] = useState(initial ? String(initial.contracts) : '1')
  const [label, setLabel] = useState(mode === 'edit' ? initial?.label ?? '' : '')
  const [ivOverride, setIvOverride] = useState(
    mode === 'edit' && initial?.iv_override != null ? String(+(initial.iv_override * 100).toFixed(4)) : '',
  )
  const [remark, setRemark] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const strikeRef = useRef<HTMLInputElement>(null)

  useEffect(() => { strikeRef.current?.focus() }, [])

  // Spot the premium is measured against: the original entry spot when
  // editing (unless re-marking), otherwise the current spot.
  const entrySpot = mode === 'edit' && initial && !remark ? initial.spot_at_entry : spot
  const enteredAt = mode === 'edit' && initial && !remark ? initial.entered_at : new Date().toISOString()

  const parsed = {
    strike: parseNum(strike),
    premium: parseNum(premium),
    contracts: parseNum(contracts),
    iv: ivOverride.trim() === '' ? null : parseNum(ivOverride) / 100,
  }

  const validation = ((): string | null => {
    if (!(parsed.strike > 0)) return 'Strike must be a positive number.'
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return 'Pick an expiry date.'
    if (expiry <= todayISO() && mode !== 'edit') return 'Expiry must be in the future.'
    if (!(parsed.premium > 0)) return 'Premium must be a positive number.'
    if (!Number.isInteger(parsed.contracts) || parsed.contracts < 1) return 'Contracts must be a whole number ≥ 1.'
    if (parsed.iv !== null && !(parsed.iv >= 0.01 && parsed.iv <= 3)) return 'IV override must be between 1 and 300.'
    if (!(entrySpot && entrySpot > 0)) return 'Set SPX spot in the market bar first.'
    return null
  })()

  const preview = useMemo(() => {
    if (validation) return null
    return solveCandidate({
      id: '', user_id: '', label: null, type, strike: parsed.strike, expiry, premium: parsed.premium,
      contracts: parsed.contracts, iv_override: parsed.iv, spot_at_entry: entrySpot!, entered_at: enteredAt, archived: false,
    }, market)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validation, type, parsed.strike, expiry, parsed.premium, parsed.contracts, parsed.iv, entrySpot, enteredAt, market])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (validation) { setError(validation); return }
    setBusy(true)
    setError(null)
    try {
      await onSubmit({
        label: label.trim() || null,
        type,
        strike: parsed.strike,
        expiry,
        premium: parsed.premium,
        contracts: parsed.contracts,
        iv_override: parsed.iv,
        spot_at_entry: entrySpot!,
      }, mode !== 'edit' || remark)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
      setBusy(false)
    }
  }

  return (
    <form className="inv-panel inv-form" onSubmit={submit}>
      <div className="inv-form-head">
        <h2>{mode === 'edit' ? 'Edit candidate' : mode === 'duplicate' ? 'Next strike' : 'New candidate'}</h2>
        <div className="inv-seg" role="radiogroup" aria-label="Option type">
          {(['call', 'put'] as const).map(t => (
            <button key={t} type="button" role="radio" aria-checked={type === t}
              className={type === t ? 'on' : ''} onClick={() => setType(t)}>{t}</button>
          ))}
        </div>
      </div>
      <div className="inv-form-grid">
        <label className="inv-field">
          <span>Strike</span>
          <input ref={strikeRef} inputMode="decimal" value={strike} onChange={e => setStrike(e.target.value)} />
        </label>
        <label className="inv-field">
          <span>Expiry</span>
          <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} />
        </label>
        <label className="inv-field">
          <span>Premium (per share)</span>
          <input inputMode="decimal" value={premium} onChange={e => setPremium(e.target.value)} placeholder="e.g. 152.40" />
        </label>
        <label className="inv-field">
          <span>Contracts</span>
          <input inputMode="numeric" value={contracts} onChange={e => setContracts(e.target.value)} />
        </label>
        <label className="inv-field">
          <span>Label (optional)</span>
          <input value={label} onChange={e => setLabel(e.target.value)} />
        </label>
        <label className="inv-field">
          <span>IV override % (optional)</span>
          <input inputMode="decimal" value={ivOverride} onChange={e => setIvOverride(e.target.value)} placeholder="solve from premium" />
        </label>
      </div>
      {mode === 'edit' && (
        <label className="inv-check">
          <input type="checkbox" checked={remark} onChange={e => setRemark(e.target.checked)} />
          Re-mark at current spot{spot ? ` (${spot})` : ''} — use when the premium is a fresh quote
        </label>
      )}
      <div className="inv-form-foot">
        <span className="inv-preview">
          {preview && (preview.option
            ? <>IV {pct(preview.option.iv)}{preview.ivSource === 'override' ? ' (override)' : ''} · cost ${(preview.cost).toLocaleString('en-US')}</>
            : <span className="inv-err">{preview.ivError}</span>)}
          {!preview && validation && (strike || premium) ? <span className="inv-muted">{validation}</span> : null}
        </span>
        <div className="inv-actions">
          <button type="button" className="inv-btn ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="submit" className="inv-btn" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      {error && <div className="inv-err">{error}</div>}
    </form>
  )
}
