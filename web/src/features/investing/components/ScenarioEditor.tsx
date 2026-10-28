import { useState } from 'react'
import { addMonths, todayISO } from '../../../lib/options/index.js'
import { roundLevel } from '../lib/model'
import { level, parseNum, shortDate } from '../lib/format'
import type { ScenarioSettings } from '../lib/types'

interface Props {
  settings: ScenarioSettings
  spot: number | null
  expiries: string[]
  onChange: (patch: Partial<ScenarioSettings>) => void
}

const LEVEL_PCTS = [-10, 0, 10, 20, 30]

function uniqSortedDates(ds: string[]) { return Array.from(new Set(ds)).sort() }
function uniqSortedLevels(ls: number[]) { return Array.from(new Set(ls)).sort((a, b) => a - b) }

export default function ScenarioEditor({ settings, spot, expiries, onChange }: Props) {
  const [dateInput, setDateInput] = useState('')
  const [levelInput, setLevelInput] = useState('')
  const { scenario_dates: dates, scenario_levels: levels } = settings

  const addDates = (...ds: string[]) => onChange({ scenario_dates: uniqSortedDates([...dates, ...ds.filter(Boolean)]) })
  const addLevels = (...ls: number[]) => onChange({ scenario_levels: uniqSortedLevels([...levels, ...ls.filter(l => l > 0)]) })
  const today = todayISO()

  return (
    <section className="inv-panel">
      <h2>Scenarios</h2>

      <div className="inv-sub">Dates</div>
      <div className="inv-chips">
        {dates.length === 0 && <span className="inv-muted">none</span>}
        {dates.map(d => (
          <button key={d} type="button" className="inv-chip" onClick={() => onChange({ scenario_dates: dates.filter(x => x !== d) })}
            aria-label={`Remove ${d}`}>
            {shortDate(d)} <span aria-hidden>×</span>
          </button>
        ))}
      </div>
      <div className="inv-row">
        <input type="date" value={dateInput} onChange={e => setDateInput(e.target.value)} aria-label="Scenario date" />
        <button type="button" className="inv-btn sm" disabled={!dateInput} onClick={() => { addDates(dateInput); setDateInput('') }}>Add</button>
      </div>
      <div className="inv-quick">
        <button type="button" className="inv-btn ghost sm" onClick={() => addDates(addMonths(today, 6))}>+6mo</button>
        <button type="button" className="inv-btn ghost sm" onClick={() => addDates(addMonths(today, 12))}>+1yr</button>
        <button type="button" className="inv-btn ghost sm" disabled={expiries.length === 0} onClick={() => addDates(...expiries)}>
          Expiries ({expiries.length})
        </button>
      </div>

      <div className="inv-sub">SPX levels</div>
      <div className="inv-chips">
        {levels.length === 0 && <span className="inv-muted">none</span>}
        {levels.map(l => (
          <button key={l} type="button" className="inv-chip" onClick={() => onChange({ scenario_levels: levels.filter(x => x !== l) })}
            aria-label={`Remove ${l}`}>
            {level(l)} <span aria-hidden>×</span>
          </button>
        ))}
      </div>
      <div className="inv-row">
        <input inputMode="decimal" placeholder="SPX level" value={levelInput} onChange={e => setLevelInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { addLevels(parseNum(levelInput)); setLevelInput('') } }} aria-label="SPX level" />
        <button type="button" className="inv-btn sm" disabled={!(parseNum(levelInput) > 0)}
          onClick={() => { addLevels(parseNum(levelInput)); setLevelInput('') }}>Add</button>
      </div>
      <div className="inv-quick">
        {LEVEL_PCTS.map(p => (
          <button key={p} type="button" className="inv-btn ghost sm" disabled={!spot}
            onClick={() => spot && addLevels(roundLevel(spot * (1 + p / 100)))}>
            {p > 0 ? `+${p}` : p === 0 ? '±0' : `−${-p}`}%
          </button>
        ))}
        <button type="button" className="inv-btn ghost sm" disabled={!spot}
          onClick={() => spot && addLevels(...LEVEL_PCTS.map(p => roundLevel(spot * (1 + p / 100))))}>All</button>
      </div>

      <div className="inv-sub">
        IV shift <strong>{settings.iv_shift >= 0 ? '+' : '−'}{Math.abs(settings.iv_shift * 100).toFixed(1)}</strong> vol pts
        {settings.iv_shift !== 0 && <button type="button" className="inv-link" onClick={() => onChange({ iv_shift: 0 })}>reset</button>}
      </div>
      <input type="range" min={-10} max={10} step={0.5} className="inv-slider"
        value={settings.iv_shift * 100}
        onChange={e => onChange({ iv_shift: Number(e.target.value) / 100 })}
        aria-label="IV shift in vol points" />
    </section>
  )
}
