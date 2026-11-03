import { describe, expect, it } from 'vitest'
import { planMerge } from './merge'
import type { CandidateRow, ScenarioSettings } from './types'

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

function cand(id: string, strike = 6000): CandidateRow {
  return {
    id, user_id: '', label: null, type: 'call', strike, expiry: '2027-12-17', premium: 100,
    contracts: 1, iv_override: null, spot_at_entry: 5900, entered_at: '2026-11-01T00:00:00Z', archived: false,
  }
}

const S = (levels: number[]): ScenarioSettings => ({ scenario_dates: [], scenario_levels: levels, iv_shift: 0, div_yield: 0.013 })

describe('planMerge', () => {
  it('inserts device-only candidates and keeps their UUID', () => {
    const plan = planMerge(
      { candidates: [cand(uuid(1)), cand(uuid(2))], scenarios: null },
      { candidates: [], scenarios: null, scenariosUpdatedAt: null },
    )
    expect(plan.insert.map(c => c.id)).toEqual([uuid(1), uuid(2)])
    expect(plan.insert[0]).not.toHaveProperty('user_id')
  })

  it('never overwrites a candidate that is already on the server', () => {
    const plan = planMerge(
      { candidates: [cand(uuid(1), 7000)], scenarios: null },
      { candidates: [cand(uuid(1), 6000)], scenarios: null, scenariosUpdatedAt: null },
    )
    expect(plan.insert).toEqual([])
  })

  it('dedupes repeated device ids', () => {
    const plan = planMerge(
      { candidates: [cand(uuid(3)), cand(uuid(3))], scenarios: null },
      { candidates: [], scenarios: null, scenariosUpdatedAt: null },
    )
    expect(plan.insert).toHaveLength(1)
  })

  it('drops non-UUID device ids so the server assigns one', () => {
    const plan = planMerge(
      { candidates: [cand('local-123-abc')], scenarios: null },
      { candidates: [], scenarios: null, scenariosUpdatedAt: null },
    )
    expect(plan.insert[0].id).toBeUndefined()
  })

  it('pushes device scenarios when the account has none', () => {
    const plan = planMerge(
      { candidates: [], scenarios: S([6000, 6500]) },
      { candidates: [], scenarios: null, scenariosUpdatedAt: null },
    )
    expect(plan.scenarios?.scenario_levels).toEqual([6000, 6500])
  })

  it('keeps newer server scenarios', () => {
    const plan = planMerge(
      { candidates: [], scenarios: { ...S([1]), updated_at: '2026-11-01T00:00:00Z' } },
      { candidates: [], scenarios: S([2]), scenariosUpdatedAt: '2026-11-02T00:00:00Z' },
    )
    expect(plan.scenarios).toBeNull()
  })

  it('takes device scenarios saved after the server row', () => {
    const plan = planMerge(
      { candidates: [], scenarios: { ...S([1]), updated_at: '2026-11-03T00:00:00Z' } },
      { candidates: [], scenarios: S([2]), scenariosUpdatedAt: '2026-11-02T00:00:00Z' },
    )
    expect(plan.scenarios).toEqual(S([1]))
  })

  it('ignores untouched default device scenarios', () => {
    const plan = planMerge(
      { candidates: [], scenarios: S([]) },
      { candidates: [], scenarios: null, scenariosUpdatedAt: null },
    )
    expect(plan.scenarios).toBeNull()
  })
})
