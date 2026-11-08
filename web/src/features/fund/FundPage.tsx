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
//   What if      one-time / recurring deposits and withdrawals vs doing nothing
//   Calculus     1st–4th derivatives and the integral of the history
//
// Market data (fund_market via /api/fund-market): S&P 500 benchmark, the
// 3-month T-bill as Sharpe/Sortino's risk-free rate, CPI for what-if raises.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { addEntry, deleteEntry, loadFund, loadMarket, subscribeEntries, updateEntry, type EntryDraft } from './lib/api'
import type { FundMarket } from './lib/macro'
import { buildLedger, type FundEntry, type FundMember } from './lib/ledger'
import { historyStats, monthlyReturns, seriesOf } from './lib/analytics'
import { longDate, money, monthEndAfter, pct, signedMoney, todayISO } from './lib/format'
import EntryForm from './components/EntryForm'
import LedgerTable from './components/LedgerTable'
import HistoryLog from './components/HistoryLog'
import StatsGrid from './components/StatsGrid'
import Forecast from './components/Forecast'
import Calculus from './components/Calculus'
import WhatIf from './components/WhatIf'
import type { ProjectionInput } from './lib/projection'
import Tour from '../../components/Tour'
import { markTourDone, tourDone, TOUR_EVENT } from '../../lib/tour'
import { FUND_STEPS, FUND_TOUR } from './tourSteps'
import './fund.css'

export default function FundPage() {
  const [members, setMembers] = useState<FundMember[]>([])
  const [entries, setEntries] = useState<FundEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<{ initial: FundEntry | null } | null>(null)
  const [saving, setSaving] = useState(false)
  const [version, setVersion] = useState(0)
  const [projInput, setProjInput] = useState<ProjectionInput | null>(null)
  const [market, setMarket] = useState<FundMarket | null>(null)
  const [touring, setTouring] = useState(false)

  const reload = useCallback(() => {
    loadFund()
      .then(d => { setMembers(d.members); setEntries(d.entries); setError(null); setVersion(v => v + 1) })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load the fund'))
  }, [])

  useEffect(() => { reload() }, [reload])
  useEffect(() => subscribeEntries(reload), [reload])
  // First visit on this device: run the tour once the sections (and the
  // forecast, which the later steps point at) have rendered. Replays come
  // from the account menu.
  const ready = !!entries && !!projInput
  useEffect(() => {
    if (!ready || tourDone(FUND_TOUR)) return
    const t = setTimeout(() => setTouring(true), 800)
    return () => clearTimeout(t)
  }, [ready])
  useEffect(() => {
    const onReplay = (e: Event) => { if ((e as CustomEvent).detail === FUND_TOUR) setTouring(true) }
    window.addEventListener(TOUR_EVENT, onReplay)
    return () => window.removeEventListener(TOUR_EVENT, onReplay)
  }, [])
  // Optional: without it the page works as before (rf = 0, no benchmark).
  useEffect(() => { loadMarket().then(setMarket).catch(() => setMarket(null)) }, [])

  const ledger = useMemo(() => buildLedger(entries ?? [], members), [entries, members])
  const returns = useMemo(() => monthlyReturns(ledger), [ledger])
  const rf = market?.tbill_3m ?? 0
  const stats = useMemo(() => historyStats(ledger, returns, rf), [ledger, returns, rf])
  const balanceSeries = useMemo(() => seriesOf(ledger, 'balance'), [ledger])
  const starts = useMemo(() => ledger.members.map(m => ({ user_id: m.member.user_id, label: m.member.label, balance: m.balance })), [ledger])

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
      {touring && <Tour steps={FUND_STEPS} onClose={() => { setTouring(false); markTourDone(FUND_TOUR) }} />}
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
              <StatsGrid s={stats} market={market} />
            </section>

            <section aria-labelledby="fund-forecast" className="stack">
              <h2 id="fund-forecast">Projections</h2>
              <p className="muted">
                Starts from history ({returns.length} months). Drag the sliders to add doubt, fade the hot streak or plan withdrawals.
                A model, not a promise.
              </p>
              <Forecast ledger={ledger} returns={returns} history={balanceSeries} market={market} onInput={setProjInput} />
            </section>

            {projInput && (
              <section aria-labelledby="fund-whatif" className="stack">
                <h2 id="fund-whatif">What if</h2>
                <WhatIf input={projInput} members={members} starts={starts} inflation={market?.cpi_yoy ?? null}
                  lastDate={balanceSeries.dates.at(-1) ?? todayISO()} />
              </section>
            )}

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
