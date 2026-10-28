// Shared table for the comparison matrix (rows = candidates) and the
// per-candidate detail view (rows = dates). Sticky first column,
// horizontal scroll on narrow screens, best cell per column highlighted.

import type { ReactNode } from 'react'
import { bestPerColumn, formatMetric, type Cell } from '../lib/model'
import { level } from '../lib/format'
import type { CellMetric } from '../lib/types'

function relLabel(l: number, spot: number): string {
  const p = Math.round((l / spot - 1) * 100)
  return p === 0 ? '±0%' : `${p > 0 ? '+' : '−'}${Math.abs(p)}%`
}

interface Props {
  corner: string
  rowHeads: ReactNode[]
  levels: number[]
  spot: number | null
  cells: Cell[][]
  metric: CellMetric
  highlightBest: boolean
}

export default function ScenarioGrid({ corner, rowHeads, levels, spot, cells, metric, highlightBest }: Props) {
  const best = highlightBest && cells.length > 1 ? bestPerColumn(cells) : []
  return (
    <div className="inv-scroll">
      <table className="inv-grid">
        <thead>
          <tr>
            <th scope="col">{corner}</th>
            {levels.map(l => (
              <th key={l} scope="col">
                {level(l)}
                {spot ? <small>{relLabel(l, spot)}</small> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cells.map((row, i) => (
            <tr key={i}>
              <th scope="row">{rowHeads[i]}</th>
              {row.map((cell, j) => {
                if (cell.kind === 'expired') return <td key={j} className="inv-cell-na">expired</td>
                if (cell.kind === 'n/a') return <td key={j} className="inv-cell-na">—</td>
                const sign = cell.pnl > 0 ? 'up' : cell.pnl < 0 ? 'down' : ''
                return (
                  <td key={j} className={`${sign}${best[j] === i ? ' best' : ''}`}
                    title={cell.atExpiry ? 'Intrinsic at expiry' : undefined}>
                    {formatMetric(metric, cell.metric)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
