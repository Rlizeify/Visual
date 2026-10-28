import type { MarketParams } from '../../../lib/options/index.js'
import { positionGreeks, type SolvedCandidate } from '../lib/model'
import { candidateName, level, money, pct, shortDate } from '../lib/format'

interface Props {
  items: SolvedCandidate[]
  asOf: string
  spot: number | null
  market: MarketParams
  archivedView: boolean
  onEdit: (id: string) => void
  onDuplicate: (id: string) => void
  onArchive: (id: string, archived: boolean) => void
  onOpen: (id: string) => void
}

export default function CandidateList(p: Props) {
  if (p.items.length === 0) {
    return <p className="inv-muted inv-empty">{p.archivedView ? 'No archived candidates.' : 'No candidates yet. Add one above.'}</p>
  }
  return (
    <ul className="inv-cands">
      {p.items.map(c => {
        const g = positionGreeks(c, p.asOf, p.spot ?? c.row.spot_at_entry, p.market)
        return (
          <li key={c.row.id} className="inv-cand">
            <button type="button" className="inv-cand-main" onClick={() => p.onOpen(c.row.id)}>
              <span className="inv-cand-name">{candidateName(c.row)}</span>
              <span className="inv-muted">
                {c.row.type} {level(c.row.strike)} · {shortDate(c.row.expiry)} · ×{c.row.contracts} @ {c.row.premium}
              </span>
            </button>
            <dl className="inv-stats">
              <div><dt>Cost</dt><dd>{money(c.cost)}</dd></div>
              <div>
                <dt>IV{c.ivSource === 'override' ? ' (ovr)' : ''}</dt>
                <dd>{c.option ? pct(c.option.iv) : '—'}</dd>
              </div>
              <div><dt>Delta</dt><dd>{g ? g.delta.toFixed(3) : '—'}</dd></div>
              <div><dt>Theta/day</dt><dd>{g ? money(g.thetaPerDay) : '—'}</dd></div>
              <div><dt>B/E @ exp</dt><dd>{level(c.breakeven)}</dd></div>
            </dl>
            {c.ivError && <div className="inv-err">{c.ivError} Set an IV override to include it.</div>}
            <div className="inv-cand-actions">
              {!p.archivedView && <button type="button" className="inv-btn ghost sm" onClick={() => p.onDuplicate(c.row.id)}>Duplicate</button>}
              {!p.archivedView && <button type="button" className="inv-btn ghost sm" onClick={() => p.onEdit(c.row.id)}>Edit</button>}
              <button type="button" className="inv-btn ghost sm" onClick={() => p.onArchive(c.row.id, !p.archivedView)}>
                {p.archivedView ? 'Restore' : 'Archive'}
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
