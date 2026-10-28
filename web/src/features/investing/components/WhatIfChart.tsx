// Robinhood-style what-if: P&L vs SPX level for one candidate at a
// chosen date, with the at-expiry payoff as a dashed reference. Drag
// (or tap) across the chart to move the SPX level; the date slider
// moves from today to expiry. Readout shows potential profit at the
// selected point.

import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { addMonths, daysBetween, todayISO, type MarketParams } from '../../../lib/options/index.js'
import { scenarioCell, type SolvedCandidate } from '../lib/model'
import { level, money, shortDate } from '../lib/format'

interface Props {
  candidate: SolvedCandidate
  spot: number | null
  ivShift: number
  market: MarketParams
}

const W = 340
const H = 200
const PAD = { l: 8, r: 8, t: 14, b: 22 }
const N = 121

function isoPlusDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

function niceStep(range: number): number {
  const raw = range / 4
  const p = 10 ** Math.floor(Math.log10(raw))
  return [1, 2, 2.5, 5, 10].map(k => k * p).find(s => s >= raw) ?? raw
}

export default function WhatIfChart({ candidate, spot, ivShift, market }: Props) {
  const c = candidate
  const center = spot ?? c.row.spot_at_entry
  const today = todayISO()
  const totalDays = Math.max(0, daysBetween(today, c.row.expiry))

  // Default the date to +6mo (or expiry if sooner) — a useful first look.
  const [dayOffset, setDayOffset] = useState(() => Math.min(totalDays, Math.max(0, daysBetween(today, addMonths(today, 6)))))
  const [lvl, setLvl] = useState(() => Math.round(Math.max(center * 1.1, c.breakeven) / 5) * 5)
  const svgRef = useRef<SVGSVGElement>(null)
  const date = isoPlusDays(today, Math.min(dayOffset, totalDays))

  const lo = Math.floor(Math.min(center, c.row.strike) * 0.7 / 50) * 50
  const hi = Math.ceil(Math.max(center, c.row.strike, c.breakeven) * 1.25 / 50) * 50
  const clampedLvl = Math.min(hi, Math.max(lo, lvl))

  const series = useMemo(() => {
    const xs = Array.from({ length: N }, (_, i) => lo + (hi - lo) * i / (N - 1))
    const pnlAt = (d: string, x: number) => {
      const cell = scenarioCell(c, d, x, ivShift, market, 'pnl')
      return cell.kind === 'value' ? cell.pnl : 0
    }
    return { xs, now: xs.map(x => pnlAt(date, x)), exp: xs.map(x => pnlAt(c.row.expiry, x)) }
  }, [c, date, ivShift, market, lo, hi])

  if (!c.option) return <p className="inv-err">{c.ivError} Set an IV override to see the chart.</p>

  const yMin = Math.min(...series.now, ...series.exp, 0)
  const yMax = Math.max(...series.now, ...series.exp, 0)
  const yPad = (yMax - yMin) * 0.08 || 1
  const y0 = yMin - yPad
  const y1 = yMax + yPad
  const sx = (x: number) => PAD.l + (x - lo) / (hi - lo) * (W - PAD.l - PAD.r)
  const sy = (v: number) => PAD.t + (y1 - v) / (y1 - y0) * (H - PAD.t - PAD.b)
  const path = (ys: number[]) => ys.map((v, i) => `${i ? 'L' : 'M'}${sx(series.xs[i]).toFixed(1)},${sy(v).toFixed(1)}`).join('')

  const sel = scenarioCell(c, date, clampedLvl, ivShift, market, 'pnl')
  const selPnl = sel.kind === 'value' ? sel.pnl : 0
  const selValue = sel.kind === 'value' ? sel.value : 0
  const xStep = niceStep(hi - lo)
  const xTicks: number[] = []
  for (let t = Math.ceil(lo / xStep) * xStep; t <= hi; t += xStep) xTicks.push(t)

  function onPointer(e: PointerEvent<SVGSVGElement>) {
    if (e.type === 'pointermove' && e.buttons === 0 && e.pointerType === 'mouse') return
    const rect = svgRef.current!.getBoundingClientRect()
    const frac = (e.clientX - rect.left) / rect.width
    const x = lo + (frac * W - PAD.l) / (W - PAD.l - PAD.r) * (hi - lo)
    setLvl(Math.round(Math.min(hi, Math.max(lo, x)) / 5) * 5)
  }

  const pct = selPnl / c.cost
  const sign = selPnl > 0 ? 'up' : selPnl < 0 ? 'down' : ''

  return (
    <div className="inv-whatif">
      <div className="inv-readout">
        <div className="inv-readout-label">
          If SPX is <strong>{level(clampedLvl)}</strong>
          {spot ? <> ({clampedLvl >= spot ? '+' : '−'}{Math.abs((clampedLvl / spot - 1) * 100).toFixed(1)}%)</> : null}
          {' '}on <strong>{shortDate(date)}</strong>{sel.kind === 'value' && sel.atExpiry ? ' (expiry)' : ''}
        </div>
        <div className={`inv-readout-pnl ${sign}`}>
          {selPnl >= 0 ? '+' : '−'}{money(Math.abs(selPnl))}
          <span> {pct >= 0 ? '+' : '−'}{Math.abs(pct * 100).toFixed(0)}%</span>
        </div>
        <div className="inv-muted">
          Option worth {money(selValue * 100 * c.row.contracts)} vs {money(c.cost)} paid
        </div>
      </div>

      <div className="inv-legend" aria-hidden>
        <span><i className="now" /> {shortDate(date)}</span>
        <span><i className="exp" /> at expiry ({shortDate(c.row.expiry)})</span>
        {spot ? <span><i className="spot" /> spot now</span> : null}
      </div>
      <svg
        ref={svgRef}
        className="inv-chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Profit and loss versus SPX level on ${shortDate(date)} and at expiry`}
        onPointerDown={e => { (e.target as Element).setPointerCapture?.(e.pointerId); onPointer(e) }}
        onPointerMove={onPointer}
      >
        {/* zero line */}
        <line x1={PAD.l} x2={W - PAD.r} y1={sy(0)} y2={sy(0)} className="inv-chart-zero" />
        {xTicks.map(t => (
          <text key={t} x={sx(t)} y={H - 6} className="inv-chart-tick" textAnchor="middle">{level(t)}</text>
        ))}
        {spot && spot > lo && spot < hi && (
          <line x1={sx(spot)} x2={sx(spot)} y1={PAD.t} y2={H - PAD.b} className="inv-chart-spot" />
        )}
        <path d={path(series.exp)} className="inv-chart-exp" />
        <path d={path(series.now)} className="inv-chart-now" />
        {/* crosshair */}
        <line x1={sx(clampedLvl)} x2={sx(clampedLvl)} y1={PAD.t} y2={H - PAD.b} className="inv-chart-cross" />
        <circle cx={sx(clampedLvl)} cy={sy(selPnl)} r={5} className="inv-chart-dot" />
      </svg>

      <label className="inv-field">
        <span>SPX level · drag the chart or slide</span>
        <input type="range" className="inv-slider" min={lo} max={hi} step={5} value={clampedLvl}
          onChange={e => setLvl(Number(e.target.value))} aria-label="SPX level" />
      </label>
      <label className="inv-field">
        <span>Date · {shortDate(date)} ({Math.min(dayOffset, totalDays)}d from today{totalDays ? `, ${totalDays - Math.min(dayOffset, totalDays)}d to expiry` : ''})</span>
        <input type="range" className="inv-slider" min={0} max={totalDays} step={1} value={Math.min(dayOffset, totalDays)}
          disabled={totalDays === 0} onChange={e => setDayOffset(Number(e.target.value))} aria-label="Scenario date" />
      </label>
    </div>
  )
}
