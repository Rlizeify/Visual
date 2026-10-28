// /investing — SPX option candidate comparison.
//
// Enter candidates with premiums typed from the broker; IV is solved
// from premium + spot at entry. Compare projected P&L across the
// user's scenario dates × SPX levels with a European Black-Scholes
// model at constant IV (plus a global shift).
//
// Public: guests can use it without an account (data saved to this
// device's localStorage); signed-in users' data syncs via Supabase RLS.
// Market snapshot via the public /api/market-snapshot.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { addMonths, curvePoints, interpolateRate, todayISO } from '../../lib/options/index.js'
import MarketBar from './components/MarketBar'
import CandidateForm, { type FormMode } from './components/CandidateForm'
import CandidateList from './components/CandidateList'
import ScenarioEditor from './components/ScenarioEditor'
import ScenarioGrid from './components/ScenarioGrid'
import WhatIfChart from './components/WhatIfChart'
import {
  DEFAULT_SCENARIOS, fetchMarketSnapshot, insertCandidate, loadCandidates, loadScenarios, saveScenarios, updateCandidate,
} from './lib/api'
import { buildMarket, roundLevel, scenarioCell, solveCandidate } from './lib/model'
import { candidateName, parseNum, shortDate } from './lib/format'
import type { CandidateDraft, CandidateRow, CellMetric, MarketSnapshot, ScenarioSettings } from './lib/types'
import './investing.css'

const METRICS: { id: CellMetric; label: string }[] = [
  { id: 'pnl', label: '$ P&L' },
  { id: 'pct', label: '% return' },
  { id: 'multiple', label: '× cost' },
]

export default function InvestingPage() {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [candidates, setCandidates] = useState<CandidateRow[]>([])
  const [scenarios, setScenarios] = useState<ScenarioSettings>(DEFAULT_SCENARIOS)
  const [scenariosLoaded, setScenariosLoaded] = useState(false)
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null)
  const [snapWarning, setSnapWarning] = useState<string | null>(null)
  const [snapLoading, setSnapLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [spotInput, setSpotInput] = useState('')
  const [rateInput, setRateInput] = useState('')
  const [divInput, setDivInput] = useState('1.3')

  const [form, setForm] = useState<{ mode: FormMode; initial: CandidateRow | null } | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [metric, setMetric] = useState<CellMetric>('pnl')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [whatIfId, setWhatIfId] = useState<string | null>(null)
  const whatIfRef = useRef<HTMLElement>(null)

  const refreshSnapshot = useCallback(() => {
    setSnapLoading(true)
    fetchMarketSnapshot()
      .then(({ snapshot, warning }) => { setSnapshot(snapshot); setSnapWarning(warning) })
      .catch(err => setSnapWarning(err instanceof Error ? err.message : 'Snapshot failed'))
      .finally(() => setSnapLoading(false))
  }, [])

  useEffect(() => { refreshSnapshot() }, [refreshSnapshot])

  // Reloads when the user signs in/out: guest data (localStorage) and
  // account data (Supabase) are separate stores.
  useEffect(() => {
    let active = true
    setScenariosLoaded(false)
    setLoadError(null)
    Promise.all([loadCandidates(userId), loadScenarios(userId)])
      .then(([cs, sc]) => {
        if (!active) return
        setCandidates(cs)
        setScenarios(sc)
        setDivInput(String(+(sc.div_yield * 100).toFixed(4)))
        setScenariosLoaded(true)
      })
      .catch(err => { if (active) setLoadError(err instanceof Error ? err.message : 'Load failed') })
    return () => { active = false }
  }, [userId])

  // Debounced persist of scenario settings.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!scenariosLoaded) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveScenarios(userId, scenarios).then(() => setSaveError(null))
        .catch(err => setSaveError(err instanceof Error ? err.message : 'Save failed'))
    }, 600)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [userId, scenarios, scenariosLoaded])

  const patchScenarios = useCallback((patch: Partial<ScenarioSettings>) => {
    setScenarios(s => ({ ...s, ...patch }))
  }, [])

  const onDivInput = (v: string) => {
    setDivInput(v)
    const n = parseNum(v)
    if (Number.isFinite(n) && n >= 0 && n < 20) patchScenarios({ div_yield: n / 100 })
  }

  // Effective market inputs.
  const manualSpot = parseNum(spotInput)
  const spot = manualSpot > 0 ? manualSpot : snapshot?.spx_close ?? null
  const manualRate = parseNum(rateInput)
  const rateOverride = Number.isFinite(manualRate) && rateInput.trim() !== '' ? manualRate / 100 : null
  const market = useMemo(
    () => buildMarket(snapshot?.treasury_curve, rateOverride, scenarios.div_yield),
    [snapshot?.treasury_curve, rateOverride, scenarios.div_yield],
  )
  const autoRate = useMemo(() => interpolateRate(curvePoints(snapshot?.treasury_curve), 1), [snapshot?.treasury_curve])

  const today = todayISO()
  const solvedAll = useMemo(() => candidates.map(c => solveCandidate(c, market)), [candidates, market])
  const active = useMemo(() => solvedAll.filter(c => !c.row.archived), [solvedAll])
  const archived = useMemo(() => solvedAll.filter(c => c.row.archived), [solvedAll])

  // Until the user adds their own, the grid uses defaults so profit is
  // visible immediately: +6mo / +1yr / each expiry, and −10..+30% of spot.
  const usingDefaultDates = scenarios.scenario_dates.length === 0
  const usingDefaultLevels = scenarios.scenario_levels.length === 0
  const refSpot = spot ?? active[0]?.row.spot_at_entry ?? null
  const dates = useMemo(() => usingDefaultDates
    ? Array.from(new Set([addMonths(today, 6), addMonths(today, 12), ...active.map(c => c.row.expiry)])).sort()
    : scenarios.scenario_dates, [usingDefaultDates, scenarios.scenario_dates, active, today])
  const levels = useMemo(() => usingDefaultLevels
    ? (refSpot ? [-10, 0, 10, 20, 30].map(p => roundLevel(refSpot * (1 + p / 100))) : [])
    : scenarios.scenario_levels, [usingDefaultLevels, scenarios.scenario_levels, refSpot])
  const matrixDate = selectedDate && dates.includes(selectedDate) ? selectedDate : dates[0] ?? null
  const expiries = Array.from(new Set(active.map(c => c.row.expiry))).sort()

  const matrixCells = useMemo(() => {
    if (!matrixDate) return []
    return active.map(c => levels.map(l => scenarioCell(c, matrixDate, l, scenarios.iv_shift, market, metric)))
  }, [active, matrixDate, levels, scenarios.iv_shift, market, metric])

  const detail = detailId ? solvedAll.find(c => c.row.id === detailId) ?? null : null
  const whatIf = active.find(c => c.row.id === whatIfId) ?? active[active.length - 1] ?? null
  const openWhatIf = (id: string) => {
    setWhatIfId(id)
    whatIfRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const detailCells = useMemo(() => {
    if (!detail) return []
    return dates.map(d => levels.map(l => scenarioCell(detail, d, l, scenarios.iv_shift, market, metric)))
  }, [detail, dates, levels, scenarios.iv_shift, market, metric])

  async function submitForm(draft: CandidateDraft, remark: boolean) {
    if (!form) return
    if (form.mode === 'edit' && form.initial) {
      const patch = remark ? { ...draft, entered_at: new Date().toISOString() } : draft
      const updated = await updateCandidate(userId, form.initial.id, patch)
      setCandidates(cs => cs.map(c => (c.id === updated.id ? updated : c)))
    } else {
      const created = await insertCandidate(userId, draft)
      setCandidates(cs => [...cs, created])
      setWhatIfId(created.id)
    }
    setForm(null)
  }

  async function setArchived(id: string, value: boolean) {
    try {
      const updated = await updateCandidate(userId, id, { archived: value })
      setCandidates(cs => cs.map(c => (c.id === id ? updated : c)))
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Archive failed')
    }
  }

  const byId = (id: string) => candidates.find(c => c.id === id) ?? null

  return (
    <div className="inv-root">
      <div className="inv-shell">
        <header className="inv-head">
          <h1>SPX options</h1>
          <p className="inv-disclaimer">Model estimate — constant IV, European Black-Scholes, not a quote.</p>
          {!user && (
            <p className="inv-muted inv-guest">
              Saved on this device only. <Link to="/login">Sign in</Link> to sync across devices.
            </p>
          )}
        </header>

        {loadError && <div className="inv-err inv-banner">Couldn&apos;t load your data: {loadError}</div>}
        {saveError && <div className="inv-err inv-banner">Save failed: {saveError}</div>}

        <MarketBar
          snapshot={snapshot} warning={snapWarning} loading={snapLoading}
          spotInput={spotInput} onSpotInput={setSpotInput}
          rateInput={rateInput} onRateInput={setRateInput} autoRate={autoRate}
          divInput={divInput} onDivInput={onDivInput}
          onRefresh={refreshSnapshot}
        />

        {form ? (
          <CandidateForm
            key={`${form.mode}:${form.initial?.id ?? 'new'}`}
            mode={form.mode} initial={form.initial} spot={spot} market={market}
            onSubmit={submitForm} onCancel={() => setForm(null)}
          />
        ) : (
          <button type="button" className="inv-btn inv-add" onClick={() => setForm({ mode: 'new', initial: null })}>
            + Add candidate
          </button>
        )}

        <section className="inv-panel">
          <div className="inv-panel-head">
            <h2>{showArchived ? 'Archived' : 'Candidates'}</h2>
            <button type="button" className="inv-link" onClick={() => setShowArchived(v => !v)}>
              {showArchived ? 'show active' : `archived (${archived.length})`}
            </button>
          </div>
          <CandidateList
            items={showArchived ? archived : active}
            archivedView={showArchived}
            asOf={today} spot={spot} market={market}
            onEdit={id => setForm({ mode: 'edit', initial: byId(id) })}
            onDuplicate={id => setForm({ mode: 'duplicate', initial: byId(id) })}
            onArchive={setArchived}
            onOpen={openWhatIf}
          />
        </section>

        {whatIf && (
          <section className="inv-panel" ref={whatIfRef}>
            <div className="inv-panel-head">
              <h2>What if · potential profit</h2>
              <button type="button" className="inv-link" onClick={() => setDetailId(whatIf.row.id)}>full grid</button>
            </div>
            {active.length > 1 && (
              <div className="inv-chips" role="radiogroup" aria-label="Candidate">
                {active.map(c => (
                  <button key={c.row.id} type="button" role="radio" aria-checked={c === whatIf}
                    className={`inv-chip${c === whatIf ? ' on' : ''}`} onClick={() => setWhatIfId(c.row.id)}>
                    {candidateName(c.row)}
                  </button>
                ))}
              </div>
            )}
            <WhatIfChart key={whatIf.row.id} candidate={whatIf} spot={spot} ivShift={scenarios.iv_shift} market={market} />
          </section>
        )}

        <ScenarioEditor settings={scenarios} spot={refSpot} expiries={expiries} onChange={patchScenarios} />

        <section className="inv-panel">
          <div className="inv-panel-head">
            <h2>Compare</h2>
            <div className="inv-seg" role="radiogroup" aria-label="Cell metric">
              {METRICS.map(m => (
                <button key={m.id} type="button" role="radio" aria-checked={metric === m.id}
                  className={metric === m.id ? 'on' : ''} onClick={() => setMetric(m.id)}>{m.label}</button>
              ))}
            </div>
          </div>
          {dates.length > 0 && (
            <div className="inv-chips" role="radiogroup" aria-label="Scenario date">
              {dates.map(d => (
                <button key={d} type="button" role="radio" aria-checked={d === matrixDate}
                  className={`inv-chip${d === matrixDate ? ' on' : ''}`} onClick={() => setSelectedDate(d)}>
                  {shortDate(d)}
                </button>
              ))}
            </div>
          )}
          {(usingDefaultDates || usingDefaultLevels) && active.length > 0 && (
            <p className="inv-muted">Showing default {usingDefaultDates ? 'dates' : ''}{usingDefaultDates && usingDefaultLevels ? ' and ' : ''}{usingDefaultLevels ? 'SPX levels' : ''} — add your own under Scenarios.</p>
          )}
          {active.length === 0 || dates.length === 0 || levels.length === 0 ? (
            <p className="inv-muted inv-empty">{active.length === 0 ? 'Add a candidate to see potential profit.' : 'Enter SPX spot in the market bar to see the grid.'}</p>
          ) : (
            <ScenarioGrid
              corner={matrixDate ? shortDate(matrixDate) : ''}
              rowHeads={active.map(c => (
                <button key={c.row.id} type="button" className="inv-rowhead" onClick={() => setDetailId(c.row.id)}>
                  {candidateName(c.row)}
                </button>
              ))}
              levels={levels} spot={spot} cells={matrixCells} metric={metric} highlightBest
            />
          )}
          {scenarios.iv_shift !== 0 && (
            <p className="inv-muted">IV shifted {scenarios.iv_shift > 0 ? '+' : '−'}{Math.abs(scenarios.iv_shift * 100).toFixed(1)} vol pts.</p>
          )}
        </section>
      </div>

      {detail && (
        <div className="inv-sheet-backdrop" onClick={() => setDetailId(null)}>
          <div className="inv-sheet" role="dialog" aria-modal="true" aria-label={candidateName(detail.row)}
            onClick={e => e.stopPropagation()}>
            <div className="inv-panel-head">
              <h2>{candidateName(detail.row)}</h2>
              <button type="button" className="inv-btn ghost sm" onClick={() => setDetailId(null)}>Close</button>
            </div>
            <p className="inv-muted">
              {detail.row.type} {detail.row.strike} · exp {shortDate(detail.row.expiry)} · ×{detail.row.contracts} @ {detail.row.premium}
              {detail.option ? ` · IV ${(detail.option.iv * 100).toFixed(1)}%` : ''}
            </p>
            {detail.ivError ? <div className="inv-err">{detail.ivError}</div>
              : dates.length === 0 || levels.length === 0
                ? <p className="inv-muted inv-empty">Add scenario dates and levels.</p>
                : (
                  <ScenarioGrid
                    corner="Date" rowHeads={dates.map(d => shortDate(d))}
                    levels={levels} spot={spot} cells={detailCells} metric={metric} highlightBest={false}
                  />
                )}
          </div>
        </div>
      )}
    </div>
  )
}
