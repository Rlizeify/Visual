// History numbers, each with a one-line plain-English meaning.

import type { HistoryStats } from '../lib/analytics'
import { money, monthLabel, pct, signedPct } from '../lib/format'

interface Stat { label: string; value: string; hint: string; tone?: 'pos' | 'neg' }

export default function StatsGrid({ s }: { s: HistoryStats }) {
  const stats: Stat[] = [
    { label: 'Avg month', value: signedPct(s.meanMonthly), hint: 'Simple average of the monthly returns.' },
    { label: 'Compounded month', value: signedPct(s.geoMonthly), hint: 'The steady rate that would give the same result.' },
    { label: 'Annualized', value: signedPct(s.annualized, 1), hint: 'Compounded month over 12 months.' },
    { label: 'Your return (IRR)', value: s.irr === null ? '—' : signedPct(s.irr, 1), hint: 'Yearly return on your actual deposit timing.' },
    { label: 'Total return (TWR)', value: signedPct(s.twr, 1), hint: 'Growth of $1 held since Jan 2025.' },
    { label: 'Volatility', value: pct(s.sdMonthly), hint: `How much months swing (${pct(s.annualVol, 1)} a year).` },
    { label: 'Best month', value: s.best ? `${signedPct(s.best.r)} · ${monthLabel(s.best.date)}` : '—', hint: 'Highest monthly return.', tone: 'pos' },
    { label: 'Worst month', value: s.worst ? `${signedPct(s.worst.r)} · ${monthLabel(s.worst.date)}` : '—', hint: 'Lowest monthly return.' },
    { label: 'Up months', value: `${Math.round(s.winRate * s.months)} of ${s.months}`, hint: 'Months with a gain.' },
    { label: 'Max drawdown', value: pct(s.maxDrawdown, 1), hint: 'Biggest fall from a high (0% = never fell).', tone: s.maxDrawdown < 0 ? 'neg' : undefined },
    { label: 'Sharpe', value: s.sharpe.toFixed(1), hint: 'Return per unit of swing, yearly. Above 1 is good; very high usually means the swings are understated.' },
    { label: 'Sortino', value: Number.isFinite(s.sortino) ? s.sortino.toFixed(1) : '∞', hint: 'Like Sharpe but only counts down months (∞ = none).' },
    { label: 'Skew', value: s.skew.toFixed(2), hint: 'Below 0: occasional bad months are bigger than good ones.' },
    { label: 'Excess kurtosis', value: s.kurtosis.toFixed(2), hint: 'Above 0: more extreme months than a bell curve.' },
    { label: 'Return trend', value: `${signedPct(s.trendPerMonth, 3)} / mo`, hint: 'Is the monthly return itself rising or falling?' },
    { label: 'Doubling time', value: s.monthsToDouble ? `${s.monthsToDouble.toFixed(1)} mo` : '—', hint: 'Months to double at the compounded rate.' },
    { label: 'Avg gain, 3 mo', value: money(s.avgGain3, 0), hint: 'Average dollars gained, last 3 months.' },
    { label: 'Avg gain, 12 mo', value: money(s.avgGain12, 0), hint: 'Average dollars gained, last 12 months.' },
  ]
  return (
    <dl className="fund-stats">
      {stats.map(x => (
        <div key={x.label} className="fund-stat">
          <dt>{x.label}</dt>
          <dd className={x.tone ?? ''}>{x.value}</dd>
          <dd className="fund-stat__hint">{x.hint}</dd>
        </div>
      ))}
    </dl>
  )
}
