// Data access for /investing. Signed-in users' candidates and scenarios
// go straight through the RLS-scoped client (auth.uid() = user_id).
// Guests (userId = null) get the same API backed by localStorage —
// device-only, no account needed. The market snapshot comes from the
// public /api/market-snapshot so the server can refresh it on demand,
// with a direct table read (signed-in only) as fallback.

import { supabase } from '../../../lib/supabase'
import type { CandidateDraft, CandidateRow, MarketSnapshot, ScenarioSettings } from './types'
import { planMerge, type LocalScenarios } from './merge'

export const DEFAULT_SCENARIOS: ScenarioSettings = {
  scenario_dates: [],
  scenario_levels: [],
  iv_shift: 0,
  div_yield: 0.013,
}

function toCandidate(r: Record<string, unknown>): CandidateRow {
  return {
    id: String(r.id),
    user_id: String(r.user_id),
    label: (r.label as string | null) ?? null,
    type: r.type === 'put' ? 'put' : 'call',
    strike: Number(r.strike),
    expiry: String(r.expiry),
    premium: Number(r.premium),
    contracts: Number(r.contracts),
    iv_override: r.iv_override == null ? null : Number(r.iv_override),
    spot_at_entry: Number(r.spot_at_entry),
    entered_at: String(r.entered_at),
    archived: Boolean(r.archived),
  }
}

// ---------- guest storage (localStorage) ----------

const LOCAL_CANDIDATES = 'mheu_investing_candidates'
const LOCAL_SCENARIOS = 'mheu_investing_scenarios'

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeLocal(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    throw new Error('Could not save on this device (storage blocked or full).')
  }
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// ---------- candidates ----------

export async function loadCandidates(userId: string | null): Promise<CandidateRow[]> {
  if (!userId) return readLocal<Record<string, unknown>[]>(LOCAL_CANDIDATES, []).map(toCandidate)
  const { data, error } = await supabase
    .from('option_candidates')
    .select('*')
    .eq('user_id', userId)
    .order('entered_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(toCandidate)
}

export async function insertCandidate(
  userId: string | null,
  draft: CandidateDraft,
): Promise<CandidateRow> {
  if (!userId) {
    const row: CandidateRow = { ...draft, id: newId(), user_id: '', entered_at: new Date().toISOString(), archived: false }
    writeLocal(LOCAL_CANDIDATES, [...readLocal<CandidateRow[]>(LOCAL_CANDIDATES, []), row])
    return row
  }
  const { data, error } = await supabase
    .from('option_candidates')
    .insert({ ...draft, user_id: userId })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return toCandidate(data)
}

export async function updateCandidate(
  userId: string | null,
  id: string,
  patch: Partial<CandidateDraft> & { archived?: boolean; entered_at?: string },
): Promise<CandidateRow> {
  if (!userId) {
    const rows = readLocal<CandidateRow[]>(LOCAL_CANDIDATES, [])
    const idx = rows.findIndex(r => r.id === id)
    if (idx < 0) throw new Error('Candidate not found on this device.')
    rows[idx] = { ...rows[idx], ...patch }
    writeLocal(LOCAL_CANDIDATES, rows)
    return toCandidate(rows[idx] as unknown as Record<string, unknown>)
  }
  const { data, error } = await supabase
    .from('option_candidates')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return toCandidate(data)
}

// ---------- scenarios ----------

export async function loadScenarios(userId: string | null): Promise<ScenarioSettings> {
  if (!userId) {
    const { updated_at: _t, ...local } = readLocal<Partial<LocalScenarios>>(LOCAL_SCENARIOS, {})
    return { ...DEFAULT_SCENARIOS, ...local }
  }
  const { data, error } = await supabase
    .from('investing_scenarios')
    .select('scenario_dates, scenario_levels, iv_shift, div_yield')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return DEFAULT_SCENARIOS
  return {
    scenario_dates: (data.scenario_dates ?? []).map(String),
    scenario_levels: (data.scenario_levels ?? []).map(Number),
    iv_shift: Number(data.iv_shift ?? 0),
    div_yield: Number(data.div_yield ?? DEFAULT_SCENARIOS.div_yield),
  }
}

export async function saveScenarios(userId: string | null, s: ScenarioSettings): Promise<void> {
  if (!userId) { writeLocal(LOCAL_SCENARIOS, { ...s, updated_at: new Date().toISOString() }); return }
  const { error } = await supabase
    .from('investing_scenarios')
    .upsert({ user_id: userId, ...s, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) throw new Error(error.message)
}

// ---------- guest → account merge ----------

/** True when this device holds guest data that hasn't been merged yet. */
export function hasGuestData(): boolean {
  return readLocal<unknown[]>(LOCAL_CANDIDATES, []).length > 0 || readLocal<object | null>(LOCAL_SCENARIOS, null) !== null
}

/**
 * Move this device's guest candidates/scenarios into the signed-in
 * account (see lib/merge.ts for the rules), then clear the device copy
 * so it can't be merged twice. Returns how many candidates were added.
 */
export async function mergeGuestData(userId: string): Promise<number> {
  if (!hasGuestData()) return 0
  const localCandidates = readLocal<Record<string, unknown>[]>(LOCAL_CANDIDATES, []).map(toCandidate)
  const localScenarios = readLocal<LocalScenarios | null>(LOCAL_SCENARIOS, null)

  const [serverCandidates, serverScenarioRow] = await Promise.all([
    loadCandidates(userId),
    supabase.from('investing_scenarios')
      .select('scenario_dates, scenario_levels, iv_shift, div_yield, updated_at')
      .eq('user_id', userId).maybeSingle()
      .then(({ data, error }) => { if (error) throw new Error(error.message); return data }),
  ])

  const plan = planMerge(
    { candidates: localCandidates, scenarios: localScenarios ? { ...DEFAULT_SCENARIOS, ...localScenarios } : null },
    {
      candidates: serverCandidates,
      scenarios: serverScenarioRow ? {
        scenario_dates: (serverScenarioRow.scenario_dates ?? []).map(String),
        scenario_levels: (serverScenarioRow.scenario_levels ?? []).map(Number),
        iv_shift: Number(serverScenarioRow.iv_shift ?? 0),
        div_yield: Number(serverScenarioRow.div_yield ?? DEFAULT_SCENARIOS.div_yield),
      } : null,
      scenariosUpdatedAt: serverScenarioRow?.updated_at ?? null,
    },
  )

  if (plan.insert.length) {
    const { error } = await supabase.from('option_candidates')
      .upsert(plan.insert.map(c => ({ ...c, user_id: userId })), { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw new Error(error.message)
  }
  if (plan.scenarios) await saveScenarios(userId, plan.scenarios)

  try {
    localStorage.removeItem(LOCAL_CANDIDATES)
    localStorage.removeItem(LOCAL_SCENARIOS)
  } catch { /* private mode: nothing was stored */ }
  return plan.insert.length
}

/** `force` asks the server to re-fetch unless it fetched within the last minute. */
export async function fetchMarketSnapshot(force = false): Promise<{ snapshot: MarketSnapshot | null; warning: string | null }> {
  try {
    const res = await fetch(force ? '/api/market-snapshot?force=1' : '/api/market-snapshot', { cache: 'no-store' })
    const body = await res.json().catch(() => null)
    if (body?.snapshot) {
      return { snapshot: body.snapshot as MarketSnapshot, warning: body.refreshError ?? null }
    }
  } catch {
    // fall through to the direct read
  }
  const { data } = await supabase
    .from('market_snapshot')
    .select('as_of, spx_close, treasury_curve, curve_date, source, fetched_at')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (data) return { snapshot: data as MarketSnapshot, warning: 'Live refresh unavailable — showing last stored snapshot.' }
  return { snapshot: null, warning: 'No market snapshot available — enter SPX spot manually.' }
}
