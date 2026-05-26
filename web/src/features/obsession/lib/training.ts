// Training data layer — goals, strava activities, mynetdiary entries.

import { supabase } from '../../../lib/supabase'
import type {
  ObsessionTrainingGoalRow,
  ObsessionStravaActivityRow,
  ObsessionStravaTokenRow,
  ObsessionMyNetDiaryEntryRow,
  ObsessionGoalKind,
} from './types'

// ---- Goals ----------------------------------------------------------------

export async function fetchGoals(userId: string): Promise<ObsessionTrainingGoalRow[]> {
  const { data, error } = await supabase
    .from('obsession_training_goals')
    .select('*')
    .eq('user_id', userId)
    .order('target_date', { ascending: true, nullsFirst: false })
  if (error) {
    console.warn('[obsession] goals fetch failed:', error.message)
    return []
  }
  return (data ?? []) as ObsessionTrainingGoalRow[]
}

export async function createGoal(userId: string, input: {
  name: string
  kind: ObsessionGoalKind
  target_date: string | null
  notes?: string
}): Promise<ObsessionTrainingGoalRow | null> {
  const { data, error } = await supabase
    .from('obsession_training_goals')
    .insert({
      user_id: userId,
      name: input.name,
      kind: input.kind,
      target_date: input.target_date,
      notes: input.notes ?? '',
    })
    .select('*')
    .single()
  if (error) {
    console.warn('[obsession] goal create failed:', error.message)
    return null
  }
  return data as ObsessionTrainingGoalRow
}

export async function markGoalAchieved(userId: string, goalId: string, achieved: boolean): Promise<void> {
  const { error } = await supabase
    .from('obsession_training_goals')
    .update({ achieved_at: achieved ? new Date().toISOString() : null })
    .eq('user_id', userId)
    .eq('id', goalId)
  if (error) console.warn('[obsession] goal update failed:', error.message)
}

export async function deleteGoal(userId: string, goalId: string): Promise<void> {
  const { error } = await supabase
    .from('obsession_training_goals')
    .delete()
    .eq('user_id', userId)
    .eq('id', goalId)
  if (error) console.warn('[obsession] goal delete failed:', error.message)
}

// ---- Strava ---------------------------------------------------------------

export async function fetchStravaTokenStatus(userId: string): Promise<ObsessionStravaTokenRow | null> {
  const { data, error } = await supabase
    .from('obsession_strava_tokens')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.warn('[obsession] strava token status failed:', error.message)
    return null
  }
  return (data as ObsessionStravaTokenRow) ?? null
}

export async function fetchStravaActivities(userId: string, limit = 50): Promise<ObsessionStravaActivityRow[]> {
  const { data, error } = await supabase
    .from('obsession_strava_activities')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.warn('[obsession] strava activities fetch failed:', error.message)
    return []
  }
  return (data ?? []) as ObsessionStravaActivityRow[]
}

export async function triggerStravaSync(accessToken: string): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const res = await fetch('/api/oauth?action=strava-sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: body?.error ?? `HTTP ${res.status}` }
    return { ok: true, count: body?.count ?? 0 }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

// ---- MyNetDiary -----------------------------------------------------------

export async function fetchMyNetDiaryEntries(userId: string, limit = 200): Promise<ObsessionMyNetDiaryEntryRow[]> {
  const { data, error } = await supabase
    .from('obsession_mynetdiary_entries')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false })
    .limit(limit)
  if (error) {
    console.warn('[obsession] mnd fetch failed:', error.message)
    return []
  }
  return (data ?? []) as ObsessionMyNetDiaryEntryRow[]
}

export async function deleteMyNetDiaryBatch(userId: string, batchId: string): Promise<void> {
  const { error } = await supabase
    .from('obsession_mynetdiary_entries')
    .delete()
    .eq('user_id', userId)
    .eq('upload_batch', batchId)
  if (error) console.warn('[obsession] mnd batch delete failed:', error.message)
}

/** Minimal CSV parser (no external dep). Handles quoted fields with
 *  embedded commas and escaped quotes; rejects multi-line cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQ = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; continue }
      if (ch === '"') { inQ = false; continue }
      field += ch
      continue
    }
    if (ch === '"') { inQ = true; continue }
    if (ch === ',') { cur.push(field); field = ''; continue }
    if (ch === '\r') continue
    if (ch === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; continue }
    field += ch
  }
  if (field !== '' || cur.length > 0) { cur.push(field); rows.push(cur) }
  return rows.filter(r => r.length > 0 && r.some(c => c.trim() !== ''))
}

export interface ParsedMndRow {
  entry_date: string
  food_name: string
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  raw: Record<string, string>
}

/** Best-effort header-based mapping. MyNetDiary exports vary by user
 *  locale and report type. We match a handful of common header
 *  names; rows where we can't recover (date, food) are dropped. */
export function mapMndRows(matrix: string[][]): ParsedMndRow[] {
  if (matrix.length < 2) return []
  const headers = matrix[0].map(h => h.trim().toLowerCase())
  const idx = (...candidates: string[]) => {
    for (const c of candidates) {
      const i = headers.indexOf(c.toLowerCase())
      if (i >= 0) return i
    }
    return -1
  }
  const dateI = idx('date', 'day', 'entry date')
  const foodI = idx('food', 'name', 'food name', 'item')
  const calI  = idx('calories', 'kcal', 'energy', 'cal')
  const proI  = idx('protein', 'protein (g)', 'prot')
  const carI  = idx('carbs', 'carbohydrates', 'net carbs', 'carb (g)')
  const fatI  = idx('fat', 'fats', 'total fat', 'fat (g)')
  if (dateI < 0 || foodI < 0) return []

  const num = (s: string): number | null => {
    const x = Number(s.replace(/[^0-9.\-]/g, ''))
    return Number.isFinite(x) ? x : null
  }
  // Accept YYYY-MM-DD, MM/DD/YYYY, M/D/YY.
  const date = (s: string): string | null => {
    const clean = s.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean
    const m = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
    if (m) {
      const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3]
      const mm = m[1].padStart(2, '0')
      const dd = m[2].padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }
    return null
  }

  const out: ParsedMndRow[] = []
  for (let i = 1; i < matrix.length; i++) {
    const r = matrix[i]
    const d = date(r[dateI] ?? '')
    const food = (r[foodI] ?? '').trim()
    if (!d || !food) continue
    const raw: Record<string, string> = {}
    headers.forEach((h, j) => { raw[h] = (r[j] ?? '').trim() })
    out.push({
      entry_date: d,
      food_name: food,
      calories: calI >= 0 ? num(r[calI] ?? '') : null,
      protein:  proI >= 0 ? num(r[proI] ?? '') : null,
      carbs:    carI >= 0 ? num(r[carI] ?? '') : null,
      fat:      fatI >= 0 ? num(r[fatI] ?? '') : null,
      raw,
    })
  }
  return out
}

export async function ingestMyNetDiaryCsv(userId: string, text: string): Promise<{ inserted: number; batch: string | null; skipped: number }> {
  const matrix = parseCsv(text)
  const parsed = mapMndRows(matrix)
  if (parsed.length === 0) return { inserted: 0, batch: null, skipped: matrix.length }
  const batch = crypto.randomUUID()
  const rows = parsed.map(p => ({
    user_id: userId,
    entry_date: p.entry_date,
    food_name: p.food_name,
    calories: p.calories,
    protein: p.protein,
    carbs: p.carbs,
    fat: p.fat,
    raw_csv_row: p.raw,
    upload_batch: batch,
  }))
  const { error, count } = await supabase
    .from('obsession_mynetdiary_entries')
    .insert(rows, { count: 'exact' })
  if (error) {
    console.warn('[obsession] mnd ingest failed:', error.message)
    return { inserted: 0, batch: null, skipped: rows.length }
  }
  return { inserted: count ?? rows.length, batch, skipped: matrix.length - 1 - parsed.length }
}
