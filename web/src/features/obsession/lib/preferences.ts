// Per-user Obsession preferences (duration / daily limit / source
// conflict preference). Lazily-created on first read — if the row
// doesn't exist, we return defaults and write on first save.

import { supabase } from '../../../lib/supabase'
import type {
  ObsessionPreferencesRow,
  SourceConflictPreference,
} from './types'
import {
  DEFAULT_MEDITATION_DURATION_SECONDS,
  DEFAULT_MEDITATION_DAILY_LIMIT,
  DEFAULT_SOURCE_PREFERENCE,
} from './types'

export const PREFERENCE_DEFAULTS: Pick<
  ObsessionPreferencesRow,
  'meditation_duration_seconds' | 'meditation_daily_limit' | 'source_preference_conflicts'
> = {
  meditation_duration_seconds: DEFAULT_MEDITATION_DURATION_SECONDS,
  meditation_daily_limit: DEFAULT_MEDITATION_DAILY_LIMIT,
  source_preference_conflicts: DEFAULT_SOURCE_PREFERENCE,
}

export async function loadPreferences(userId: string): Promise<ObsessionPreferencesRow> {
  const { data, error } = await supabase
    .from('obsession_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.warn('[obsession] preferences load failed:', error.message)
  }
  if (data) return data as ObsessionPreferencesRow
  const nowIso = new Date().toISOString()
  return {
    user_id: userId,
    ...PREFERENCE_DEFAULTS,
    created_at: nowIso,
    updated_at: nowIso,
  } as ObsessionPreferencesRow
}

export async function savePreferences(
  userId: string,
  patch: {
    meditation_duration_seconds?: number
    meditation_daily_limit?: number
    source_preference_conflicts?: SourceConflictPreference
  },
): Promise<ObsessionPreferencesRow> {
  const current = await loadPreferences(userId)
  const next = {
    user_id: userId,
    meditation_duration_seconds: patch.meditation_duration_seconds ?? current.meditation_duration_seconds,
    meditation_daily_limit: patch.meditation_daily_limit ?? current.meditation_daily_limit,
    source_preference_conflicts: patch.source_preference_conflicts ?? current.source_preference_conflicts,
  }
  const { data, error } = await supabase
    .from('obsession_preferences')
    .upsert(next, { onConflict: 'user_id' })
    .select('*')
    .single()
  if (error) throw error
  return data as ObsessionPreferencesRow
}
