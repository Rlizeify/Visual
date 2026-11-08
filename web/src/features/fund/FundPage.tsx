// /fund — the members' shared fund ledger and analysis.
//
// Reached with the 'fund' grant while an unlock song plays (app/songUnlock.ts).
// Data: fund_members, fund_entries, fund_entry_history (RLS has_feature('fund')),
// live-updated over Realtime so both members see each other's edits.
//
//   Shares       each member's capital account today
//   Spreadsheet  every deposit, withdrawal and monthly gain/loss
//   Statistics   time-weighted return, volatility, drawdown, IRR…
//   Forecast     Monte Carlo fan chart, sliders, Greeks, 3D surfaces
//   Calculus     1st–4th derivatives and the integral of the history

import { useCallback, useEffect, useMemo, useState } from 'react'
import { addEntry, deleteEntry, loadFund, subscribeEntries, updateEntry, type EntryDraft } from './lib/api'
import { buildLedger, type FundEntry, type FundMember } from './lib/ledger'
import { historyStats, monthlyReturns, seriesOf } from './lib/analytics'
import { longDate, money, monthEndAfter, pct, signedMoney, todayISO } from './lib/format'
import EntryForm from './components/EntryForm'
import LedgerTable from './components/LedgerTable'
import HistoryLog from './components/HistoryLog'
import StatsGrid from './components/StatsGrid'
import Forecast from './components/Forecast'
import Calculus from './components/Calculus'
import './fund.css'

export default function FundPage() {
  const [members, setMembers] = useState<FundMember[]>([])
  const [entries, setEntries] = useState<FundEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<{ initial: FundEntry | null } | null>(null)
  const [saving, setSaving] = useState(false)
  const [version, setVersion] = useState(0)

  const reload = useCallback(() => {
    loadFund()
      .then(d => { setMembers(d.members); setEntries(d.entries); setError(null); setVersion(v => v + 1) })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load the fund'))
  }, [])

  useEffect(() => { reload() }, [reload])
  useEffect(() => subscribeEntries(reload), [reload])

  const ledger = useMemo(() => buildLedger(entries ?? [], members), [entries, members])
  const returns = useMemo(() => monthlyReturns(ledger), [ledger])
  const stats = useMemo(() => historyStats(ledger, returns), [ledger, returns])
  const balanceSeries = useMemo(() => seriesOf(ledger, 'balance'), [ledger])

  const lastGain = returns.at(-1)?.date
  const defaultDate = lastGain ? monthEndAfter(lastGain, 1) : todayISO()

  const save = async (d: EntryDraft) => {
    setSaving(true)
    try {
      if (form?.initial) await updateEntry(form.initial.id, d)
      else await addEntry(d)
      setForm(null)
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (e: FundEntry) => {
    if (!window.confirm(`Delete the ${e.kind} on ${longDate(e.entry_date)}? It stays in the change log.`)) return
    try { await deleteEntry(e.id); reload() } catch (err) { setError(err instanceof Error ? err.message : 'Delete failed') }
  }

  if (!entries) {
    return <main className="fund"><div className="fund-shell"><p className="muted">{error ?? 'Loading the fund…'}</p></div></main>
  }

  const latest = ledger.rows.at(-1)
  const lastReturn = returns.at(-1)

  return (
    <main className="fund">
      <div className="fund-shell">
        <header className="fund-head">
          <p className="eyebrow">Shared fund</p>
          <h1>Fund</h1>
          <p className="fund-balance">{money(ledger.balance)}</p>
          <p className="muted">
            {latest ? <>As of {longDate(latest.entry.entry_date)}</> : 'No rows yet'}
            {lastReturn && <> · last month {signedMoney(lastReturn.gain)} ({pct(lastReturn.r)})</>}
            {' · '}deposited {money(ledger.deposited, 0)}, withdrawn {money(ledger.withdrawn, 0)}, gained {money(ledger.gains, 0)}
          </p>
        </header>

        {error && <p className="fund-banner" role="alert">{error} <button type="button" className="link-btn" onClick={() => setError(null)}>Dismiss</button></p>}

        <section aria-labelledby="fund-shares" className="stack">
          <h2 id="fund-shares">Shares today</h2>
          <div className="fund-members">
            {ledger.members.map(m => (
              <article key={m.member.user_id} className="card fund-member">
                <h3>{m.member.label}</h3>
                <p className="fund-member__balance">{money(m.balance)}</p>
                <div className="fund-share" role="img" aria-label={`${pct(m.share, 1)} of the fund`}>
                  <span style={{ width: `${Math.max(0, Math.min(100, m.share * 100))}%` }} />
                </div>
                <dl className="fund-member__facts">
                  <div><dt>Share</dt><dd>{pct(m.share, 2)}</dd></div>
                  <div><dt>Deposited</dt><dd>{money(m.deposited, 0)}</dd></div>
                  <div><dt>Withdrawn</dt><dd>{money(m.withdrawn, 0)}</dd></div>
                  <div><dt>Gains</dt><dd>{signedMoney(m.gains, 0)}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="fund-sheet" className="stack">
          <div className="row fund-chart-head">
            <h2 id="fund-sheet">Spreadsheet</h2>
            {!form && <button type="button" className="btn btn--primary btn--sm" onClick={() => setForm({ initial: null })}>Add row</button>}
          </div>
          {form && (
            <EntryForm key={form.initial?.id ?? 'new'} members={members} entries={entries} initial={form.initial}
              defaultDate={defaultDate} saving={saving} onSave={save} onCancel={() => setForm(null)} />
          )}
          <LedgerTable ledger={ledger} members={members}
            onEdit={e => { setForm({ initial: e }); document.getElementById('fund-sheet')?.scrollIntoView({ behavior: 'smooth' }) }} onDelete={remove} />
          <details className="fund-details">
            <summary>Change log</summary>
            <HistoryLog members={members} version={version} />
          </details>
        </section>

        {returns.length > 0 && (
          <>
            <section aria-labelledby="fund-stats" className="stack">
              <h2 id="fund-stats">Statistics</h2>
              <StatsGrid s={stats} />
            </section>

            <section aria-labelledby="fund-forecast" className="stack">
              <h2 id="fund-forecast">Projections</h2>
              <p className="muted">
                Starts from history ({returns.length} months). Drag the sliders to add doubt, fade the hot streak or plan withdrawals.
                A model, not a promise.
              </p>
              <Forecast ledger={ledger} returns={returns} history={balanceSeries} />
            </section>

            <section aria-labelledby="fund-calc" className="stack">
              <h2 id="fund-calc">Calculus</h2>
              <Calculus ledger={ledger} />
            </section>
          </>
        )}
      </div>
    </main>
  )
}
