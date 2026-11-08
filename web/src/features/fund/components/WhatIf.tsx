// What-if: compare scenarios of one-time / recurring deposits and
// withdrawals against doing nothing, under the Projections settings above.
// Scenarios are saved on this device (localStorage), not shared.

import { useEffect, useMemo, useState } from 'react'
import Plot from '../charts/Plot'
import { baseLayout, chartTheme, jet } from '../charts/theme'
import type { ProjectionInput } from '../lib/projection'
import type { FundMember } from '../lib/ledger'
import {
  flatWithdrawal, flowAt, runScenario, safeWithdrawal,
  type Flow, type MemberStart, type Repeat, type Scenario,
} from '../lib/whatif'
import { longDate, money, monthEndAfter, parseNum, pct, signedMoney } from '../lib/format'

interface Props { input: ProjectionInput; members: FundMember[]; starts: MemberStart[]; lastDate: string }

const KEY = 'mheu_fund_whatif_v1'
const REPEATS: { id: Repeat; label: string }[] = [
  { id: 'once', label: 'One time' },
  { id: 'monthly', label: 'Every month' },
  { id: 'quarterly', label: 'Every 3 months' },
  { id: 'semiannual', label: 'Every 6 months' },
  { id: 'yearly', label: 'Every year' },
  { id: 'custom', label: 'Every N months' },
]

const uid = () => Math.random().toString(36).slice(2, 10)

function newFlow(kind: Flow['kind'] = 'withdrawal'): Flow {
  return { id: uid(), kind, amount: 5000, start: 1, repeat: 'once', every: 2, times: null, raise: 0, split: null }
}

const NOTHING: Scenario = { id: 'nothing', name: 'Do nothing', flows: [] }
const DEFAULTS: Scenario[] = [
  NOTHING,
  { id: 'a', name: 'Plan A', flows: [{ ...newFlow('withdrawal'), id: 'a1', amount: 10000 }] },
]

function load(): Scenario[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as Scenario[]) : null
    if (Array.isArray(parsed) && parsed.length) return [NOTHING, ...parsed.filter(s => s.id !== 'nothing')]
  } catch { /* private mode or bad JSON: use defaults */ }
  return DEFAULTS
}

/** `YYYY-MM` for month offset k after the last ledger month, and back. */
function monthInput(lastDate: string, k: number) { return monthEndAfter(lastDate, k).slice(0, 7) }
function offsetOf(lastDate: string, ym: string) {
  const [ly, lm] = lastDate.split('-').map(Number)
  const [y, m] = ym.split('-').map(Number)
  return (y * 12 + m) - (ly * 12 + lm)
}

export default function WhatIf({ input, members, starts, lastDate }: Props) {
  const [scenarios, setScenarios] = useState<Scenario[]>(load)
  const [selected, setSelected] = useState(scenarios[1]?.id ?? 'nothing')
  const [quick, setQuick] = useState<{ safe: number; flat: number } | null>(null)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(scenarios.filter(s => s.id !== 'nothing'))) } catch { /* ignore */ }
  }, [scenarios])

  // Expensive (bisection over the simulation): wait for the sliders to settle.
  useEffect(() => {
    setQuick(null)
    const t = setTimeout(() => setQuick({ safe: safeWithdrawal(input, starts), flat: flatWithdrawal(input, starts) }), 400)
    return () => clearTimeout(t)
  }, [input, starts])

  const H = Math.max(1, Math.round(input.months))
  const results = useMemo(() => scenarios.map(s => ({ s, r: runScenario(s, input, starts) })), [scenarios, input, starts])
  const dates = useMemo(() => Array.from({ length: H + 1 }, (_, k) => monthEndAfter(lastDate, k)), [H, lastDate])
  const cur = scenarios.find(s => s.id === selected) ?? scenarios[0]

  const update = (id: string, f: (s: Scenario) => Scenario) => setScenarios(xs => xs.map(s => s.id === id ? f(s) : s))
  const setFlow = (fid: string, patch: Partial<Flow>) => update(cur.id, s => ({ ...s, flows: s.flows.map(f => f.id === fid ? { ...f, ...patch } : f) }))
  const addScenario = (flows: Flow[] = [], name = `Plan ${String.fromCharCode(64 + scenarios.length)}`) => {
    const s = { id: uid(), name, flows }
    setScenarios(xs => [...xs, s]); setSelected(s.id)
  }

  const { data, layout } = useMemo(() => {
    const c = chartTheme()
    const traces: Record<string, unknown>[] = []
    const sel = results.find(x => x.s.id === cur.id)
    if (sel) {
      traces.push({ x: dates, y: sel.r.bands.p10, mode: 'lines', line: { width: 0 }, hoverinfo: 'skip', showlegend: false })
      traces.push({ x: dates, y: sel.r.bands.p90, mode: 'lines', line: { width: 0 }, fill: 'tonexty', fillcolor: jet(0.4, 0.2),
        hoverinfo: 'skip', name: `${cur.name.replace(/[<>]/g, '')} 80% range` })
    }
    const n = results.length - 1 // scenarios besides "do nothing"
    results.forEach(({ s, r }, i) => {
      // Cyan → orange: the bright middle of jet, readable on the dark surface.
      const color = s.id === 'nothing' ? c.muted : jet(n <= 1 ? 0.62 : 0.35 + (0.5 * (i - 1)) / (n - 1))
      traces.push({
        x: dates, y: r.bands.p50, mode: 'lines', name: s.name.replace(/[<>]/g, ''),
        line: { width: s.id === cur.id ? 3.5 : 1.75, color, dash: s.id === 'nothing' ? 'dash' : 'solid' },
        hovertemplate: `${s.name.replace(/[<>]/g, '')} %{y:$,.0f}<extra></extra>`,
      })
    })
    // Cash-flow markers for the selected scenario.
    const fx: string[] = [], fy: number[] = [], ft: string[] = [], fc: string[] = []
    if (sel) for (let k = 1; k <= H; k++) {
      const a = cur.flows.reduce((sum, f) => sum + flowAt(f, k), 0)
      if (a !== 0) { fx.push(dates[k]); fy.push(sel.r.bands.p50[k]); ft.push(signedMoney(a, 0)); fc.push(a > 0 ? jet(0.75) : jet(0.95)) }
    }
    if (fx.length) traces.push({ x: fx, y: fy, mode: 'markers', text: ft, name: 'Cash flows', marker: { size: 9, color: fc, symbol: 'diamond', line: { width: 1, color: c.strong } },
      hovertemplate: 'Cash %{text}<extra></extra>' })
    return {
      data: traces,
      layout: baseLayout({
        showlegend: true,
        legend: { orientation: 'h', y: -0.18, font: { color: c.text } },
        margin: { l: 64, r: 16, t: 16, b: 64 },
        xaxis: { ...(baseLayout().xaxis as object), type: 'date' },
        yaxis: { ...(baseLayout().yaxis as object), tickformat: '$,.3~s' },
      }),
    }
  }, [results, dates, cur, H])

  const base = results[0]?.r

  return (
    <div className="stack fund-whatif">
      <p className="muted">
        Uses the Projections settings above ({pct(input.mean)} / mo, {pct(input.sd)} swing, {H} months). Months count from {longDate(lastDate)}.
        Scenarios are saved on this device.
      </p>

      <div className="fund-quick">
        <div className="fund-stat">
          <dt>Safe monthly withdrawal</dt>
          <dd>{quick ? money(quick.safe, 0) : '…'}</dd>
          <dd className="fund-stat__hint">Never runs dry in 95% of futures over {H} months (split equally).</dd>
          {quick && quick.safe > 0 && (
            <button type="button" className="link-btn" onClick={() => addScenario([{ ...newFlow(), amount: quick.safe, repeat: 'monthly' }], 'Safe withdrawal')}>Try it</button>
          )}
        </div>
        <div className="fund-stat">
          <dt>Keeps the balance flat</dt>
          <dd>{quick ? money(quick.flat, 0) : '…'}</dd>
          <dd className="fund-stat__hint">Monthly withdrawal where the median ends at today&apos;s balance.</dd>
          {quick && quick.flat > 0 && (
            <button type="button" className="link-btn" onClick={() => addScenario([{ ...newFlow(), amount: quick.flat, repeat: 'monthly' }], 'Live off gains')}>Try it</button>
          )}
        </div>
      </div>

      <div className="fund-chips" role="tablist" aria-label="Scenarios">
        {scenarios.map(s => (
          <button key={s.id} type="button" role="tab" aria-selected={s.id === cur.id}
            className={`fund-chip${s.id === cur.id ? ' on' : ''}`} onClick={() => setSelected(s.id)}>{s.name}</button>
        ))}
        <button type="button" className="fund-chip" onClick={() => addScenario()}>+ New scenario</button>
      </div>

      {cur.id === 'nothing' ? (
        <p className="muted">The baseline: no deposits or withdrawals. Pick or add a scenario to edit it.</p>
      ) : (
        <div className="card stack fund-scenario" role="tabpanel" aria-label={cur.name}>
          <div className="fund-form__grid">
            <label className="field">
              <span>Scenario name</span>
              <input className="input" maxLength={40} value={cur.name} onChange={e => update(cur.id, s => ({ ...s, name: e.target.value }))} />
            </label>
          </div>
          {cur.flows.length === 0 && <p className="muted">No cash flows yet — this behaves like doing nothing.</p>}
          {cur.flows.map(f => (
            <FlowRow key={f.id} f={f} members={members} lastDate={lastDate} horizon={H}
              onChange={patch => setFlow(f.id, patch)}
              onRemove={() => update(cur.id, s => ({ ...s, flows: s.flows.filter(x => x.id !== f.id) }))} />
          ))}
          <div className="row">
            <button type="button" className="btn btn--sm" onClick={() => update(cur.id, s => ({ ...s, flows: [...s.flows, newFlow('withdrawal')] }))}>+ Withdrawal</button>
            <button type="button" className="btn btn--sm" onClick={() => update(cur.id, s => ({ ...s, flows: [...s.flows, newFlow('deposit')] }))}>+ Deposit</button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => addScenario(cur.flows.map(f => ({ ...f, id: uid() })), `${cur.name} copy`)}>Duplicate</button>
            <button type="button" className="btn btn--danger btn--sm" onClick={() => {
              setScenarios(xs => xs.filter(s => s.id !== cur.id)); setSelected('nothing')
            }}>Delete scenario</button>
          </div>
        </div>
      )}

      <Plot data={data} layout={layout} height="clamp(18rem, 50vh, 28rem)"
        label={`What-if comparison: median balance by month for ${scenarios.map(s => s.name).join(', ')}`} />

      <div className="table-wrap">
        <table className="table table--stack">
          <thead>
            <tr>
              <th scope="col">Scenario</th>
              <th scope="col" className="num">End balance (median)</th>
              <th scope="col" className="num">Bad case (P5)</th>
              <th scope="col" className="num">Good case (P95)</th>
              <th scope="col" className="num">Cash taken out</th>
              <th scope="col" className="num">Put in</th>
              <th scope="col" className="num">Ahead by</th>
              <th scope="col" className="num">vs nothing</th>
              <th scope="col" className="num">Can&apos;t pay</th>
              {members.map(m => <th key={m.user_id} scope="col" className="num">{m.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {results.map(({ s, r }) => (
              <tr key={s.id} className={s.id === cur.id ? 'is-selected' : ''}>
                <td data-label="Scenario"><button type="button" className="link-btn" onClick={() => setSelected(s.id)}>{s.name}</button></td>
                <td data-label="End balance" className="num strong">{money(r.bands.p50[H], 0)}</td>
                <td data-label="Bad case (P5)" className="num">{money(r.bands.p5[H], 0)}</td>
                <td data-label="Good case (P95)" className="num">{money(r.bands.p95[H], 0)}</td>
                <td data-label="Cash taken out" className="num">{money(r.paidOut, 0)}</td>
                <td data-label="Put in" className="num">{money(r.planned.deposits, 0)}</td>
                <td data-label="Ahead by" className="num">{money(r.netWorth, 0)}</td>
                <td data-label="vs nothing" className={`num ${base && r.netWorth - base.netWorth < 0 ? 'neg' : 'pos'}`}>
                  {base ? signedMoney(r.netWorth - base.netWorth, 0) : '—'}
                </td>
                <td data-label="Can't pay" className={`num ${r.probShortfall > 0.05 ? 'neg' : ''}`}>{pct(r.probShortfall, 1)}</td>
                {r.members.map(m => (
                  <td key={m.user_id} data-label={m.label} className="num">
                    {money(m.p50, 0)}<small className="muted"> {pct(m.share, 1)}{m.paidOut > 0 ? ` · took ${money(m.paidOut, 0)}` : ''}</small>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">
        “Ahead by” = end balance + cash taken out − new deposits (median). It lets a scenario that takes money out compare fairly
        with one that leaves it in. “Can&apos;t pay” = chance a planned withdrawal is bigger than what&apos;s there at some point.
      </p>
    </div>
  )
}

function FlowRow({ f, members, lastDate, horizon, onChange, onRemove }: {
  f: Flow; members: FundMember[]; lastDate: string; horizon: number
  onChange: (p: Partial<Flow>) => void; onRemove: () => void
}) {
  const [amount, setAmount] = useState(String(f.amount))
  const custom = !!f.split
  const count = f.repeat === 'once' ? 1 : f.times
  return (
    <fieldset className={`fund-flow fund-flow--${f.kind}`}>
      <legend className="label">{f.kind === 'deposit' ? 'Deposit' : 'Withdrawal'}</legend>
      <div className="fund-form__grid">
        <label className="field">
          <span>Type</span>
          <select className="select" value={f.kind} onChange={e => onChange({ kind: e.target.value as Flow['kind'] })}>
            <option value="withdrawal">Withdrawal</option>
            <option value="deposit">Deposit</option>
          </select>
        </label>
        <label className="field">
          <span>Amount ($)</span>
          <input className="input" inputMode="decimal" value={amount}
            onChange={e => { setAmount(e.target.value); const v = parseNum(e.target.value); if (Number.isFinite(v) && v >= 0) onChange({ amount: v }) }} />
        </label>
        <label className="field">
          <span>Starting</span>
          <input className="input" type="month" min={monthInput(lastDate, 1)} max={monthInput(lastDate, 120)}
            value={monthInput(lastDate, f.start)}
            onChange={e => { const k = offsetOf(lastDate, e.target.value); if (k >= 1) onChange({ start: k }) }} />
        </label>
        <label className="field">
          <span>How often</span>
          <select className="select" value={f.repeat} onChange={e => onChange({ repeat: e.target.value as Repeat })}>
            {REPEATS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </label>
        {f.repeat === 'custom' && (
          <label className="field">
            <span>Every N months</span>
            <input className="input" type="number" min={1} max={60} value={f.every} onChange={e => onChange({ every: Math.max(1, Number(e.target.value) || 1) })} />
          </label>
        )}
        {f.repeat !== 'once' && (
          <>
            <label className="field">
              <span>Times (blank = until the end)</span>
              <input className="input" type="number" min={1} max={600} value={f.times ?? ''} placeholder="∞"
                onChange={e => onChange({ times: e.target.value === '' ? null : Math.max(1, Number(e.target.value) || 1) })} />
            </label>
            <label className="field">
              <span>Grow amount per year (%)</span>
              <input className="input" type="number" step={0.5} min={-50} max={100} value={+(f.raise * 100).toFixed(2)}
                onChange={e => onChange({ raise: (Number(e.target.value) || 0) / 100 })} />
            </label>
          </>
        )}
      </div>
      <label className="fund-check">
        <input type="checkbox" checked={!custom}
          onChange={e => onChange({ split: e.target.checked ? null : Object.fromEntries(members.map(m => [m.user_id, 100 / members.length])) })} />
        Split equally
      </label>
      {custom && (
        <div className="fund-form__grid">
          {members.map(m => (
            <label key={m.user_id} className="field">
              <span>{m.label} %</span>
              <input className="input" type="number" min={0} max={100} value={f.split?.[m.user_id] ?? 0}
                onChange={e => onChange({ split: { ...(f.split ?? {}), [m.user_id]: Math.max(0, Number(e.target.value) || 0) } })} />
            </label>
          ))}
        </div>
      )}
      <div className="row fund-chart-head">
        <small className="muted">
          {f.repeat === 'once'
            ? `Once, ${longDate(monthEndAfter(lastDate, f.start))}`
            : `${count ?? 'Until month ' + horizon} × from ${longDate(monthEndAfter(lastDate, f.start))}`}
          {f.start > horizon && ' — after the horizon, so not counted'}
        </small>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onRemove}>Remove</button>
      </div>
    </fieldset>
  )
}
