import type { MarketSnapshot } from '../lib/types'
import { level, pct } from '../lib/format'

interface Props {
  snapshot: MarketSnapshot | null
  warning: string | null
  loading: boolean
  spotInput: string
  onSpotInput: (v: string) => void
  rateInput: string
  onRateInput: (v: string) => void
  /** Auto rate at 1y from the curve, for the placeholder. */
  autoRate: number | null
  divInput: string
  onDivInput: (v: string) => void
  onRefresh: () => void
}

function asOfLabel(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short',
  })
}

export default function MarketBar(p: Props) {
  const s = p.snapshot
  return (
    <section className="inv-panel inv-market">
      <div className="inv-market-grid">
        <label className="inv-field">
          <span>SPX spot</span>
          <input
            inputMode="decimal"
            placeholder={s?.spx_close != null ? level(s.spx_close) : 'enter spot'}
            value={p.spotInput}
            onChange={e => p.onSpotInput(e.target.value)}
          />
        </label>
        <label className="inv-field">
          <span>Rate %{p.rateInput ? ' (manual)' : ' (curve)'}</span>
          <input
            inputMode="decimal"
            placeholder={p.autoRate != null ? `auto · 1y ${pct(p.autoRate, 2)}` : 'auto'}
            value={p.rateInput}
            onChange={e => p.onRateInput(e.target.value)}
          />
        </label>
        <label className="inv-field">
          <span>Div yield %</span>
          <input inputMode="decimal" value={p.divInput} onChange={e => p.onDivInput(e.target.value)} />
        </label>
      </div>
      <div className="inv-asof">
        {p.loading ? 'Loading market snapshot…' : s ? (
          <>
            {s.spx_close != null ? <>SPX {level(s.spx_close)} as of {asOfLabel(s.as_of)}</> : <>No SPX quote</>}
            {' · '}source {s.source}
            {s.curve_date && <> · curve {s.curve_date}</>}
          </>
        ) : 'No snapshot'}
        <button type="button" className="inv-link" onClick={p.onRefresh} disabled={p.loading}>refresh</button>
      </div>
      {p.warning && <div className="inv-warn">{p.warning}</div>}
    </section>
  )
}
