import type { OptionType } from '../../../lib/options/index.js'

export interface CandidateRow {
  id: string
  user_id: string
  label: string | null
  type: OptionType
  strike: number
  /** `YYYY-MM-DD` */
  expiry: string
  /** Per-share premium as typed from the broker. */
  premium: number
  contracts: number
  /** Decimal vol (0.18), or null to solve from premium. */
  iv_override: number | null
  spot_at_entry: number
  entered_at: string
  archived: boolean
}

export type CandidateDraft = Omit<CandidateRow, 'id' | 'user_id' | 'entered_at' | 'archived'>

export interface ScenarioSettings {
  scenario_dates: string[]
  scenario_levels: number[]
  /** Decimal vol points (0.05 = +5 vol). */
  iv_shift: number
  /** Continuous dividend yield, decimal. */
  div_yield: number
}

export interface MarketSnapshot {
  as_of: string
  spx_close: number | null
  treasury_curve: Record<string, number> | null
  curve_date: string | null
  source: string
  fetched_at: string
}

export type CellMetric = 'pnl' | 'pct' | 'multiple'
