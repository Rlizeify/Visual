// Meditation data layer.
//
// Schema reminders:
//   - obsession_meditations(body, tags, session_started_at,
//     session_ended_at, day_of_entry, created_at)
//   - obsession_meditation_drafts(body, started_at, day_of_entry,
//     last_updated_at)  UNIQUE(user_id, day_of_entry)
//
// Daily limit: count today's locked-in rows vs.
// preferences.meditation_daily_limit (default 1).

import { supabase } from '../../../lib/supabase'
import type {
  ObsessionMeditationRow,
  ObsessionMeditationDraftRow,
} from './types'
import { todayLocalISODate } from './localDate'

export async function fetchMeditations(userId: string, limit = 100): Promise<ObsessionMeditationRow[]> {
  const { data, error } = await supabase
    .from('obsession_meditations')
    .select('*')
    .eq('user_id', userId)
    .order('day_of_entry', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.warn('[obsession] meditations fetch failed:', error.message)
    return []
  }
  return (data ?? []) as ObsessionMeditationRow[]
}

export async function countMeditationsForDay(userId: string, day: string): Promise<number> {
  const { count, error } = await supabase
    .from('obsession_meditations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('day_of_entry', day)
  if (error) {
    console.warn('[obsession] meditation count failed:', error.message)
    return 0
  }
  return count ?? 0
}

export async function loadDraft(userId: string, day: string): Promise<ObsessionMeditationDraftRow | null> {
  const { data, error } = await supabase
    .from('obsession_meditation_drafts')
    .select('*')
    .eq('user_id', userId)
    .eq('day_of_entry', day)
    .maybeSingle()
  if (error) {
    console.warn('[obsession] draft load failed:', error.message)
    return null
  }
  return (data as ObsessionMeditationDraftRow) ?? null
}

/** Upsert a draft. `startedAt` is the ISO timestamp the timer began;
 *  must be stable across saves so elapsed = now - started_at. */
export async function saveDraft(userId: string, day: string, body: string, startedAt: string): Promise<void> {
  const { error } = await supabase
    .from('obsession_meditation_drafts')
    .upsert({
      user_id: userId,
      day_of_entry: day,
      body,
      started_at: startedAt,
      last_updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,day_of_entry' })
  if (error) {
    console.warn('[obsession] draft save failed:', error.message)
  }
}

export async function deleteDraft(userId: string, day: string): Promise<void> {
  const { error } = await supabase
    .from('obsession_meditation_drafts')
    .delete()
    .eq('user_id', userId)
    .eq('day_of_entry', day)
  if (error) {
    console.warn('[obsession] draft delete failed:', error.message)
  }
}

export async function lockInMeditation(
  userId: string,
  body: string,
  sessionStartedAt: string,
  day: string = todayLocalISODate(),
): Promise<ObsessionMeditationRow | null> {
  const { data, error } = await supabase
    .from('obsession_meditations')
    .insert({
      user_id: userId,
      day_of_entry: day,
      body,
      tags: [],
      session_started_at: sessionStartedAt,
      session_ended_at: new Date().toISOString(),
    })
    .select('*')
    .single()
  if (error) {
    console.warn('[obsession] meditation lock-in failed:', error.message)
    return null
  }
  // Best-effort draft cleanup; not fatal if it fails.
  void deleteDraft(userId, day)
  return data as ObsessionMeditationRow
}

/** Helper — derive elapsed seconds from an ISO start. */
export function elapsedSecondsSince(startedAt: string): number {
  const ms = Date.now() - new Date(startedAt).getTime()
  return Math.max(0, Math.floor(ms / 1000))
}

/** Helper — derive duration from a row's session timestamps. */
export function durationSecondsOf(row: ObsessionMeditationRow): number {
  const a = new Date(row.session_started_at).getTime()
  const b = new Date(row.session_ended_at).getTime()
  return Math.max(0, Math.floor((b - a) / 1000))
}
