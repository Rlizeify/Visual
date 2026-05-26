// Lifts data layer.
//
// Schema reminders:
//   - obsession_lifts_exercises(name UNIQUE per user, up_arrow_flag,
//     last_session_id FK)
//   - obsession_lifts_sessions(session_date date, notes)
//   - obsession_lifts_sets(session_id FK, exercise_name text,
//     weight numeric, reps int, stop_reason CHAR, intensity 0/1/2,
//     pain_location, set_order int)
//
// Shorthand for display:
//   "35#12W / 40#10F,8F,8F↑"
//   exercise_name is per-row text; we group consecutive sets sharing
//   (exercise_name, weight).

import { supabase } from '../../../lib/supabase'
import type {
  ObsessionLiftsExerciseRow,
  ObsessionLiftsSessionRow,
  ObsessionLiftsSetRow,
  ObsessionStopReason,
  ObsessionIntensity,
} from './types'

export async function fetchExercises(userId: string): Promise<ObsessionLiftsExerciseRow[]> {
  const { data, error } = await supabase
    .from('obsession_lifts_exercises')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true })
  if (error) {
    console.warn('[obsession] exercises fetch failed:', error.message)
    return []
  }
  return (data ?? []) as ObsessionLiftsExerciseRow[]
}

export async function upsertExercise(userId: string, name: string): Promise<ObsessionLiftsExerciseRow | null> {
  const clean = name.trim()
  if (!clean) return null
  const { data, error } = await supabase
    .from('obsession_lifts_exercises')
    .upsert({ user_id: userId, name: clean }, { onConflict: 'user_id,name' })
    .select('*')
    .single()
  if (error) {
    console.warn('[obsession] exercise upsert failed:', error.message)
    return null
  }
  return data as ObsessionLiftsExerciseRow
}

export async function fetchSessions(userId: string, limit = 60): Promise<ObsessionLiftsSessionRow[]> {
  const { data, error } = await supabase
    .from('obsession_lifts_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('session_date', { ascending: false })
    .limit(limit)
  if (error) {
    console.warn('[obsession] sessions fetch failed:', error.message)
    return []
  }
  return (data ?? []) as ObsessionLiftsSessionRow[]
}

export async function createSession(userId: string, sessionDate: string, notes?: string): Promise<ObsessionLiftsSessionRow | null> {
  const { data, error } = await supabase
    .from('obsession_lifts_sessions')
    .insert({ user_id: userId, session_date: sessionDate, notes: notes ?? '' })
    .select('*')
    .single()
  if (error) {
    console.warn('[obsession] session create failed:', error.message)
    return null
  }
  return data as ObsessionLiftsSessionRow
}

export async function fetchSets(userId: string, sessionId: string): Promise<ObsessionLiftsSetRow[]> {
  const { data, error } = await supabase
    .from('obsession_lifts_sets')
    .select('*')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .order('set_order', { ascending: true })
  if (error) {
    console.warn('[obsession] sets fetch failed:', error.message)
    return []
  }
  return (data ?? []) as ObsessionLiftsSetRow[]
}

export async function fetchSetsForSessions(userId: string, sessionIds: string[]): Promise<Record<string, ObsessionLiftsSetRow[]>> {
  if (sessionIds.length === 0) return {}
  const { data, error } = await supabase
    .from('obsession_lifts_sets')
    .select('*')
    .eq('user_id', userId)
    .in('session_id', sessionIds)
    .order('set_order', { ascending: true })
  if (error) {
    console.warn('[obsession] sets bulk fetch failed:', error.message)
    return {}
  }
  const out: Record<string, ObsessionLiftsSetRow[]> = {}
  for (const r of (data ?? []) as ObsessionLiftsSetRow[]) {
    if (!out[r.session_id]) out[r.session_id] = []
    out[r.session_id].push(r)
  }
  return out
}

export interface NewSetInput {
  exercise_name: string
  set_order: number
  weight: number
  reps: number
  stop_reason: ObsessionStopReason
  intensity: ObsessionIntensity
  pain_location?: string | null
}

export async function appendSet(userId: string, sessionId: string, input: NewSetInput): Promise<ObsessionLiftsSetRow | null> {
  const { data, error } = await supabase
    .from('obsession_lifts_sets')
    .insert({
      user_id: userId,
      session_id: sessionId,
      exercise_name: input.exercise_name,
      set_order: input.set_order,
      weight: input.weight,
      reps: input.reps,
      stop_reason: input.stop_reason,
      intensity: input.intensity,
      pain_location: input.pain_location ?? null,
    })
    .select('*')
    .single()
  if (error) {
    console.warn('[obsession] set append failed:', error.message)
    return null
  }
  return data as ObsessionLiftsSetRow
}

export async function deleteSet(userId: string, setId: string): Promise<void> {
  const { error } = await supabase
    .from('obsession_lifts_sets')
    .delete()
    .eq('user_id', userId)
    .eq('id', setId)
  if (error) {
    console.warn('[obsession] set delete failed:', error.message)
  }
}

/**
 * Format a session's sets into the shorthand:
 *   "BENCH 135#10W,10W / 155#8F,7F↑"
 * Sets sharing exercise_name + weight are grouped; reps separated by
 * commas. stop_reason letter follows each reps token. ↑ = intensity 2.
 */
export function formatShorthand(sets: ObsessionLiftsSetRow[]): string {
  const groups: { ex: string; weight: number; tokens: string[] }[] = []
  for (const s of sets) {
    const last = groups[groups.length - 1]
    if (last && last.ex === s.exercise_name && last.weight === s.weight) {
      last.tokens.push(`${s.reps}${s.stop_reason}${s.intensity === 2 ? '↑' : ''}`)
    } else {
      groups.push({
        ex: s.exercise_name,
        weight: s.weight,
        tokens: [`${s.reps}${s.stop_reason}${s.intensity === 2 ? '↑' : ''}`],
      })
    }
  }
  return groups
    .map(g => `${g.ex} ${g.weight}#${g.tokens.join(',')}`)
    .join(' / ')
}
