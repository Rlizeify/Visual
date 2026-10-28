// Supabase + API access for /investing. Candidates and scenarios go
// straight through the RLS-scoped client (auth.uid() = user_id); the
// market snapshot comes from /api/market-snapshot so the server can
// refresh it on demand, with a direct table read as fallback.

import { supabase } from '../../../lib/supabase'
import type { CandidateDraft, CandidateRow, MarketSnapshot, ScenarioSettings } from './types'

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

export async function loadCandidates(userId: string): Promise<CandidateRow[]> {
  const { data, error } = await supabase
    .from('option_candidates')
    .select('*')
    .eq('user_id', userId)
    .order('entered_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map(toCandidate)
}

export async function insertCandidate(
  userId: string,
  draft: CandidateDraft,
): Promise<CandidateRow> {
  const { data, error } = await supabase
    .from('option_candidates')
    .insert({ ...draft, user_id: userId })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return toCandidate(data)
}

export async function updateCandidate(
  id: string,
  patch: Partial<CandidateDraft> & { archived?: boolean; entered_at?: string },
): Promise<CandidateRow> {
  const { data, error } = await supabase
    .from('option_candidates')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return toCandidate(data)
}

export async function loadScenarios(userId: string): Promise<ScenarioSettings> {
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

export async function saveScenarios(userId: string, s: ScenarioSettings): Promise<void> {
  const { error } = await supabase
    .from('investing_scenarios')
    .upsert({ user_id: userId, ...s, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) throw new Error(error.message)
}

export async function fetchMarketSnapshot(): Promise<{ snapshot: MarketSnapshot | null; warning: string | null }> {
  const { data: { session } } = await supabase.auth.getSession()
  try {
    const res = await fetch('/api/market-snapshot', {
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
    })
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
