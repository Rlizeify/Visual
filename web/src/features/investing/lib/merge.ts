// Guest → account merge, run once when a guest signs in.
//
// Candidates: dedupe by id. A row already on the server always wins —
// option_candidates has no updated_at, and a same-id server row can only
// exist because an earlier merge put it there, so the server copy is
// canonical. Device-only rows are inserted (keeping their UUID so a
// retried merge stays idempotent).
// Scenarios: the device copy wins only if the server has none, or the
// device copy was saved strictly later than the server row.
// Pure — the I/O lives in api.ts (mergeGuestData).

import type { CandidateRow, ScenarioSettings } from './types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface LocalScenarios extends ScenarioSettings {
  /** ISO time of the last device save; absent in data saved before merging existed. */
  updated_at?: string
}

export interface MergePlan {
  /** Rows to insert; `id` is omitted when the device id isn't a UUID. */
  insert: Array<Omit<CandidateRow, 'user_id' | 'id'> & { id?: string }>
  /** Scenario settings to upsert, or null to keep the server's. */
  scenarios: ScenarioSettings | null
}

function isDefault(s: ScenarioSettings | null | undefined): boolean {
  return !s || (s.scenario_dates.length === 0 && s.scenario_levels.length === 0 && s.iv_shift === 0)
}

export function planMerge(
  local: { candidates: CandidateRow[]; scenarios: LocalScenarios | null },
  server: { candidates: CandidateRow[]; scenarios: ScenarioSettings | null; scenariosUpdatedAt: string | null },
): MergePlan {
  const onServer = new Set(server.candidates.map(c => c.id))
  const seen = new Set<string>()
  const insert: MergePlan['insert'] = []
  for (const c of local.candidates) {
    if (onServer.has(c.id) || seen.has(c.id)) continue
    seen.add(c.id)
    const { user_id: _u, id, ...rest } = c
    insert.push(UUID.test(id) ? { ...rest, id } : rest)
  }

  let scenarios: ScenarioSettings | null = null
  const ls = local.scenarios
  if (ls && !isDefault(ls)) {
    const serverMissing = !server.scenarios || isDefault(server.scenarios)
    const localNewer = !!ls.updated_at && !!server.scenariosUpdatedAt &&
      Date.parse(ls.updated_at) > Date.parse(server.scenariosUpdatedAt)
    if (serverMissing || localNewer) {
      const { updated_at: _t, ...settings } = ls
      scenarios = settings
    }
  }
  return { insert, scenarios }
}
