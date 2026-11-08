// Projection controls + "weather forecast" fan chart, month scrubber,
// projected shares and Greeks. Defaults come from history; every knob can
// be dragged to ask "what if". With live market data: an S&P 500 benchmark
// line + comparison and an "S&P 500" preset (its 10-year monthly moments).

import { useCallback, useEffect, useMemo, useState } from 'react'
import Plot from '../charts/Plot'
import { baseLayout, chartTheme, jet } from '../charts/theme'
import { benchmarkPath, recencyWeights, weightedMoments, type MonthReturn, type Series } from '../lib/analytics'
import { benchmarkReturn, benchmarkSeries, compare, type FundMarket } from '../lib/macro'
import { greeks, project, PERCENTILES, type ProjectionInput } from '../lib/projection'
import type { Ledger } from '../lib/ledger'
import { longDate, money, monthEndAfter, pct, signedMoney, signedPct } from '../lib/format'
import Surface3D from './Surface3D'

interface Props {
  ledger: Ledger; returns: MonthReturn[]; history: Series
  market?: FundMarket | null
  /** Current settings, so What-if runs on the same assumptions. */
  onInput?: (p: ProjectionInput) => void
}

const FADES = [Infinity, 6, 12, 24, 36]
const HALF_LIVES = [Infinity, 3, 6, 12]

const PRESETS = [
  { id: 'history', label: 'History', doubt: 1, fade: Infinity, mean: null as number | null },
  { id: 'cautious', label: 'Cautious', doubt: 3, fade: 12, mean: null },
  { id: 'stress', label: 'Stress', doubt: 5, fade: 6, mean: 0.01 },
] as const

export default function Forecast({ ledger, returns, history, market, onInput }: Props) {
  const [months, setMonths] = useState(24)
  const [halfLife, setHalfLife] = useState(Infinity)
  const [meanOverride, setMeanOverride] = useState<number | null>(null)
  const [doubt, setDoubt] = useState(1)
  const [fade, setFade] = useState(Infinity)
  const [longRun, setLongRun] = useState(0.008)
  const [withdrawal, setWithdrawal] = useState(0)
  const [scrub, setScrub] = useState(12)
  const [logY, setLogY] = useState(false)
  const [showBench, setShowBench] = useState(true)

  const rs = returns.map(r => r.r)
  const hist = useMemo(() => weightedMoments(rs, recencyWeights(rs.length, halfLife)), [returns, halfLife]) // eslint-disable-line react-hooks/exhaustive-deps
  const mean = meanOverride ?? hist.mean
  const input: ProjectionInput = useMemo(() => ({
    start: ledger.balance, months, mean, sd: hist.sd * doubt, longRun, fadeHalfLife: fade, withdrawal,
  }), [ledger.balance, months, mean, hist.sd, doubt, longRun, fade, withdrawal])
  useEffect(() => { onInput?.(input) }, [input, onInput])
  const proj = useMemo(() => project(input), [input])
  const g = useMemo(() => greeks(input), [input])

  const closes = market?.benchmark ?? null
  const benchName = market?.benchmark_kind === 'total-return' ? 'S&P 500 (dividends in)' : 'S&P 500'
  const bench = useMemo(() => closes ? benchmarkPath(ledger, d => benchmarkReturn(closes, d)) : null, [ledger, closes])
  const cmp = useMemo(() => bench ? compare(bench.pairs, market?.tbill_3m ?? 0) : null, [bench, market?.tbill_3m])
  const spx = useMemo(() => {
    const rs = closes ? benchmarkSeries(closes) : []
    return rs.length >= 12 ? weightedMoments(rs, recencyWeights(rs.length, Infinity)) : null
  }, [closes])

  const lastDate = history.dates.at(-1) ?? ledger.rows.at(-1)?.entry.entry_date ?? ''
  const futureDates = useMemo(() => proj.months.map(k => monthEndAfter(lastDate, k)), [proj, lastDate])
  const k = Math.min(scrub, months)

  const { data, layout } = useMemo(() => {
    const c = chartTheme()
    const traces: Record<string, unknown>[] = []
    const band = (lo: number, hi: number, t: number) => {
      traces.push({ x: futureDates, y: proj.bands[lo as 5], mode: 'lines', line: { width: 0 }, hoverinfo: 'skip' })
      traces.push({ x: futureDates, y: proj.bands[hi as 95], mode: 'lines', line: { width: 0 }, fill: 'tonexty',
        fillcolor: jet(t, 0.28), name: `P${lo}–P${hi}`, hoverinfo: 'skip' })
    }
    band(5, 95, 0.12); band(10, 90, 0.38); band(25, 75, 0.62)
    const ranked = [...proj.samples].sort((a, b) => a.at(-1)! - b.at(-1)!)
    ranked.forEach((path, i) => traces.push({
      x: futureDates, y: path, mode: 'lines', hoverinfo: 'skip',
      line: { width: 1, color: jet(i / Math.max(1, ranked.length - 1), 0.55) },
    }))
    for (const pc of PERCENTILES) {
      if (pc === 50) continue
      traces.push({ x: futureDates, y: proj.bands[pc], mode: 'lines', name: `P${pc}`, line: { width: 0.5, color: jet(pc / 100, 0.9) },
        hovertemplate: `P${pc} %{y:$,.0f}<extra></extra>` })
    }
    traces.push({ x: futureDates, y: proj.bands[50], mode: 'lines', name: 'Median', line: { width: 3, color: c.strong },
      hovertemplate: 'Median %{y:$,.0f}<extra></extra>' })
    traces.push({ x: futureDates, y: proj.mean, mode: 'lines', name: 'Mean', line: { width: 1.5, color: c.strong, dash: 'dot' },
      hovertemplate: 'Mean %{y:$,.0f}<extra></extra>' })
    traces.push({ x: history.dates, y: history.y, mode: 'lines+markers', name: 'Actual', line: { width: 2.5, color: c.accent },
      marker: { size: 5, color: c.accent }, hovertemplate: 'Actual %{y:$,.2f}<extra></extra>' })
    if (bench && showBench && bench.series.y.length) {
      traces.push({ x: bench.series.dates, y: bench.series.y, mode: 'lines', name: benchName, line: { width: 2, color: jet(0.85), dash: 'dash' },
        hovertemplate: `${benchName} %{y:$,.2f}<extra></extra>` })
    }
    const lay = baseLayout({
      yaxis: { ...(baseLayout().yaxis as object), type: logY ? 'log' : 'linear', tickprefix: '$', tickformat: ',.0f' },
      xaxis: { ...(baseLayout().xaxis as object), type: 'date' },
      shapes: [{ type: 'line', x0: futureDates[k], x1: futureDates[k], yref: 'paper', y0: 0, y1: 1, line: { color: c.muted, width: 1, dash: 'dash' } }],
    })
    return { data: traces, layout: lay }
  }, [proj, futureDates, history, logY, k, bench, showBench, benchName])

  const onHoverX = useCallback((x: number | string) => {
    const i = futureDates.indexOf(String(x).slice(0, 10))
    if (i > 0) setScrub(i)
  }, [futureDates])

  const at = (pc: 5 | 10 | 25 | 50 | 75 | 90 | 95) => proj.bands[pc][k]
  const preset = (p: (typeof PRESETS)[number]) => { setDoubt(p.doubt); setFade(p.fade); setMeanOverride(p.mean) }
  const spxPreset = () => {
    if (!spx) return
    setMeanOverride(spx.mean); setDoubt(hist.sd > 0 ? spx.sd / hist.sd : 1); setFade(Infinity)
  }

  return (
    <div className="stack fund-forecast">
      <div className="fund-chips" role="group" aria-label="Presets">
        {PRESETS.map(p => <button key={p.id} type="button" className="fund-chip" onClick={() => preset(p)}>{p.label}</button>)}
        {spx && (
          <button type="button" className="fund-chip" onClick={spxPreset}
            title={`Last 10 years of the S&P 500: ${signedPct(spx.mean)} / mo, ${pct(spx.sd)} swing`}>S&amp;P 500</button>
        )}
      </div>

      <div className="fund-controls">
        <Slider label="Horizon" value={months} min={1} max={60} step={1} onChange={setMonths}
          display={`${months} mo · to ${longDate(monthEndAfter(lastDate, months))}`} />
        <Slider label="Expected monthly return" value={mean * 100} min={-5} max={12} step={0.05}
          onChange={v => setMeanOverride(v / 100)} display={`${signedPct(mean)}${meanOverride === null ? ' (history)' : ''}`}
          reset={meanOverride !== null ? () => setMeanOverride(null) : undefined} />
        <Slider label="Doubt (volatility ×)" value={doubt} min={0.5} max={8} step={0.1} onChange={setDoubt}
          display={`${doubt.toFixed(1)}× → ${pct(hist.sd * doubt)} / mo`} />
        <Slider label="Monthly withdrawal" value={withdrawal} min={0} max={20000} step={250} onChange={setWithdrawal}
          display={money(withdrawal, 0)} />
        <Choice label="Weight on recent months" value={halfLife} options={HALF_LIVES}
          fmt={v => Number.isFinite(v) ? `${v}-mo half-life` : 'All equal'} onChange={setHalfLife} />
        <Choice label="Returns fade toward long-run" value={fade} options={FADES}
          fmt={v => Number.isFinite(v) ? `Halves in ${v} mo` : 'No fade'} onChange={setFade} />
        {Number.isFinite(fade) && (
          <Slider label="Long-run monthly return" value={longRun * 100} min={-2} max={6} step={0.05}
            onChange={v => setLongRun(v / 100)} display={signedPct(longRun)} />
        )}
      </div>

      <div className="row fund-chart-head">
        <h3>Forecast</h3>
        <div className="row">
          {bench && <label className="fund-check"><input type="checkbox" checked={showBench} onChange={e => setShowBench(e.target.checked)} /> S&amp;P 500 benchmark</label>}
          <label className="fund-check"><input type="checkbox" checked={logY} onChange={e => setLogY(e.target.checked)} /> Log scale</label>
        </div>
      </div>
      <div data-tour="fan">
      <Plot data={data} layout={layout} height="clamp(18rem, 55vh, 30rem)" onHoverX={onHoverX}
        label={`Forecast fan chart: median ${money(proj.bands[50][months], 0)} in ${months} months, 90% range ${money(proj.bands[5][months], 0)} to ${money(proj.bands[95][months], 0)}`} />
      </div>
      <p className="muted fund-legend">
        Shaded bands hold 90%, 80% and 50% of 2,000 simulated futures (blue → cyan → yellow toward the middle).
        Thin rainbow lines are single futures from worst (blue) to best (red). Thick white is the median,
        dotted the mean, the accent line is what actually happened.
        {bench && showBench && <> The dashed orange line is the same deposits and withdrawals put in the {benchName} instead.</>}
      </p>

      {bench && showBench && cmp && (
        <>
          <h3>Benchmark: fund vs {benchName}</h3>
          <dl className="fund-stats" data-tour="benchmark">
            <Greek sym="F" name="Fund, same months" value={signedPct(cmp.fundTotal, 1)} hint={`Time-weighted, ${cmp.months} months.`} />
            <Greek sym="S" name={benchName} value={signedPct(cmp.benchTotal, 1)} hint="Same months, month-end closes." />
            <Greek sym="$" name="If it had been in the S&P" value={money(bench.series.y.at(-1) ?? 0, 0)}
              hint={`${signedMoney(ledger.balance - (bench.series.y.at(-1) ?? 0), 0)} for the fund vs the index, same cash flows.`} />
            <Greek sym="β" name="Beta" value={cmp.beta.toFixed(2)} hint="How much the fund moves per 1% S&P move (1 = in step, 0 = unrelated)." />
            <Greek sym="α" name="Alpha (yearly)" value={signedPct(cmp.alpha, 1)} hint="Return not explained by riding the market, over the T-bill rate." />
            <Greek sym="ρ" name="Correlation" value={cmp.correlation.toFixed(2)} hint="Do good fund months line up with good market months?" />
            <Greek sym="%" name="Beat the S&P" value={`${Math.round(cmp.beatRate * cmp.months)} of ${cmp.months}`} hint="Months the fund did better than the index." />
          </dl>
          <p className="muted fund-legend">
            Market data: Yahoo Finance / FRED, updated {longDate((market?.fetched_at ?? '').slice(0, 10) || lastDate)}. The current month is month to date.
          </p>
        </>
      )}

      <Slider label="Look at month" value={k} min={1} max={months} step={1} onChange={setScrub}
        display={`${k} · ${longDate(futureDates[k])}`} />
      <div className="fund-scrub">
        <dl className="fund-stats fund-stats--tight">
          {([5, 25, 50, 75, 95] as const).map(pc => (
            <div key={pc} className="fund-stat"><dt>{pc === 50 ? 'Median' : `P${pc}`}</dt><dd>{money(at(pc), 0)}</dd>
              <dd className="fund-stat__hint">{signedMoney(at(pc) - ledger.balance, 0)}</dd></div>
          ))}
        </dl>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th scope="col">Member</th><th scope="col" className="num">Share</th><th scope="col" className="num">Median</th><th scope="col" className="num">Bad case (P5)</th><th scope="col" className="num">Good case (P95)</th></tr></thead>
            <tbody>
              {ledger.members.map(m => (
                <tr key={m.member.user_id}>
                  <td>{m.member.label}</td>
                  <td className="num">{pct(m.share, 1)}</td>
                  <td className="num">{money(at(50) * m.share, 0)}</td>
                  <td className="num">{money(at(5) * m.share, 0)}</td>
                  <td className="num">{money(at(95) * m.share, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">Shares held at today&apos;s split; withdrawals above come out equally.</p>
        <p>
          Chance the fund is below today&apos;s {money(ledger.balance, 0)} at month {months}: <strong>{pct(proj.probBelowStart, 1)}</strong>
          {withdrawal > 0 && <> · chance it runs out: <strong>{pct(proj.probBroke, 1)}</strong></>}
        </p>
      </div>

      <h3>Greeks</h3>
      <p className="muted">Option-trader words for “how much does the forecast move if…”, measured at month {months}.</p>
      <dl className="fund-stats" data-tour="greeks">
        <Greek sym="Δ" name="Delta" value={signedMoney(g.delta, 0)} hint="Expected balance change if the monthly return is 1 point higher." />
        <Greek sym="Γ" name="Gamma" value={signedMoney(g.gamma, 0)} hint="How much Delta itself grows per extra point — compounding." />
        <Greek sym="ν" name="Vega" value={signedMoney(g.vega, 0)} hint="Change in the bad case (P5) if volatility is 1 point higher." />
        <Greek sym="Θ" name="Theta" value={signedMoney(g.theta, 0)} hint="Expected dollars earned over the next month (carry)." />
        <Greek sym="ρ" name="Rho" value={signedMoney(g.rho, 0)} hint="Expected balance change per extra $100 withdrawn each month." />
        <Greek sym="ε" name="Elasticity" value={`${g.elasticity.toFixed(2)}×`} hint="% balance change for a 1% change in the return rate." />
      </dl>

      <Surface3D input={input} proj={proj} lastDate={lastDate} />
    </div>
  )
}

function Slider({ label, value, min, max, step, onChange, display, reset }: {
  label: string; value: number; min: number; max: number; step: number
  onChange: (v: number) => void; display: string; reset?: () => void
}) {
  return (
    <label className="field fund-slider">
      <span className="fund-slider__head">
        <span>{label}</span>
        <output>{display}</output>
        {reset && <button type="button" className="link-btn" onClick={e => { e.preventDefault(); reset() }}>reset</button>}
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
    </label>
  )
}

function Choice({ label, value, options, fmt, onChange }: {
  label: string; value: number; options: number[]; fmt: (v: number) => string; onChange: (v: number) => void
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select className="select" value={String(value)} onChange={e => onChange(Number(e.target.value))}>
        {options.map(o => <option key={String(o)} value={String(o)}>{fmt(o)}</option>)}
      </select>
    </label>
  )
}

function Greek({ sym, name, value, hint }: { sym: string; name: string; value: string; hint: string }) {
  return (
    <div className="fund-stat">
      <dt><span className="fund-greek" aria-hidden="true">{sym}</span> {name}</dt>
      <dd>{value}</dd>
      <dd className="fund-stat__hint">{hint}</dd>
    </div>
  )
}
