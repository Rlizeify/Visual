// Derivatives (1st–4th) and the running integral of a month-end series,
// stacked on a shared time axis, rainbow-coloured by order.

import { useMemo, useState } from 'react'
import Plot from '../charts/Plot'
import { baseLayout, chartTheme, jet } from '../charts/theme'
import { cumulativeIntegral, nthDerivative, seriesOf, type SeriesKey } from '../lib/analytics'
import type { Ledger } from '../lib/ledger'
import { money } from '../lib/format'

const SERIES: { id: SeriesKey; label: string; unit: string }[] = [
  { id: 'balance', label: 'Balance', unit: '$' },
  { id: 'gains', label: 'Cumulative gains', unit: '$' },
  { id: 'index', label: 'Growth of $100', unit: '' },
]

// order -1 = running integral
const ORDERS = [
  { o: -1, sym: '∫', name: 'Integral', meaning: 'Area under the curve: dollar-months the money has been at work.' },
  { o: 0, sym: 'f', name: 'Value', meaning: 'The series itself.' },
  { o: 1, sym: "f′", name: 'Velocity', meaning: 'Dollars per month — how fast it is growing.' },
  { o: 2, sym: 'f″', name: 'Acceleration', meaning: 'Is the growth speeding up (+) or slowing (−)?' },
  { o: 3, sym: 'f‴', name: 'Jerk', meaning: 'Is the acceleration itself changing? Early sign of a turn.' },
  { o: 4, sym: 'f⁗', name: 'Snap', meaning: 'Fourth derivative; very noisy, mostly shows one-off months.' },
] as const

// Skip the darkest jet blue so every curve reads on the dark surface.
const hue = (order: number) => 0.3 + (0.7 * (order + 1)) / 5

export default function Calculus({ ledger }: { ledger: Ledger }) {
  const [key, setKey] = useState<SeriesKey>('balance')
  const [orders, setOrders] = useState<number[]>([0, 1, 2])

  const s = useMemo(() => seriesOf(ledger, key), [ledger, key])
  const curves = useMemo(() => ORDERS.filter(d => orders.includes(d.o)).map(d => ({
    ...d, y: d.o === -1 ? cumulativeIntegral(s.y) : nthDerivative(s.y, d.o),
  })), [s, orders])

  const { data, layout } = useMemo(() => {
    const c = chartTheme()
    const unit = key === 'index' ? '' : '$'
    const n = Math.max(1, curves.length)
    const gap = 0.04
    const h = (1 - gap * (n - 1)) / n
    const lay: Record<string, unknown> = baseLayout({ height: undefined, margin: { l: 72, r: 16, t: 8, b: 40 } })
    const traces = curves.map((cv, i) => {
      const ax = i === 0 ? '' : String(i + 1)
      const top = 1 - i * (h + gap)
      lay[`yaxis${ax}`] = {
        ...(baseLayout().yaxis as object), domain: [top - h, top], tickformat: `${unit},.3~s`,
        title: { text: cv.sym, font: { color: jet(hue(cv.o)), size: 16 } },
      }
      return {
        x: s.dates, y: cv.y, yaxis: `y${ax}`, xaxis: 'x', mode: 'lines+markers', name: `${cv.sym} ${cv.name}`,
        line: { width: 2, color: jet(hue(cv.o)), shape: 'spline' }, marker: { size: 4, color: jet(hue(cv.o)) },
        hovertemplate: `${cv.sym} ${unit}%{y:,.2f}<extra></extra>`,
      }
    })
    lay.xaxis = { ...(baseLayout().xaxis as object), type: 'date', anchor: `y${curves.length > 1 ? curves.length : ''}` }
    lay.shapes = curves.slice(1).map((_, i) => ({ type: 'line', xref: 'paper', x0: 0, x1: 1, yref: 'paper',
      y0: 1 - (i + 1) * (h + gap) + gap / 2, y1: 1 - (i + 1) * (h + gap) + gap / 2, line: { color: c.grid, width: 1 } }))
    return { data: traces, layout: lay }
  }, [curves, s, key])

  const toggle = (o: number) => setOrders(xs => xs.includes(o) ? xs.filter(x => x !== o) : [...xs, o].sort((a, b) => a - b))

  return (
    <div className="stack">
      <div className="fund-seg" role="radiogroup" aria-label="Series">
        {SERIES.map(x => <button key={x.id} type="button" role="radio" aria-checked={key === x.id}
          className={key === x.id ? 'on' : ''} onClick={() => setKey(x.id)}>{x.label}</button>)}
      </div>
      <div className="fund-chips" role="group" aria-label="Curves">
        {ORDERS.map(d => (
          <button key={d.o} type="button" aria-pressed={orders.includes(d.o)}
            className={`fund-chip${orders.includes(d.o) ? ' on' : ''}`} onClick={() => toggle(d.o)}>
            {d.sym} {d.name}
          </button>
        ))}
      </div>
      {curves.length > 0
        ? <Plot data={data} layout={layout} height={`clamp(16rem, ${12 + curves.length * 9}rem, 60rem)`}
            label={`${curves.map(c => c.name).join(', ')} of ${key}`} />
        : <p className="muted">Pick at least one curve.</p>}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th scope="col">Curve</th><th scope="col" className="num">Latest</th><th scope="col">Means</th></tr></thead>
          <tbody>
            {curves.map(cv => (
              <tr key={cv.o}>
                <td>{cv.sym} {cv.name}</td>
                <td className="num">{key === 'index' ? (cv.y.at(-1) ?? 0).toFixed(2) : money(cv.y.at(-1) ?? 0)}{cv.o === -1 ? '·mo' : cv.o > 0 ? `/mo${cv.o > 1 ? cv.o === 2 ? '²' : cv.o === 3 ? '³' : '⁴' : ''}` : ''}</td>
                <td className="muted">{cv.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">Month-end samples, one month apart; derivatives use central differences, the integral the trapezoid rule.</p>
    </div>
  )
}
