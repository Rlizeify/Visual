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

export const DURATION_MIN = 60
export const DURATION_MAX = 1800
export const DURATION_STEP = 30
export const LIMIT_MIN = 1
export const LIMIT_MAX = 10

// Defense-in-depth validation gate before the Supabase upsert. Obsession
// preferences write directly to Supabase via RLS (no serverless function
// in front), so this service-layer check + the DB CHECK constraints
// added in 20260607000001_obsession_pref_bounds.sql are the only thing
// stopping a tampered client (or a future caller that bypasses Settings.tsx)
// from persisting out-of-range values.
export function validatePreferencesPatch(patch: {
  meditation_duration_seconds?: number
  meditation_daily_limit?: number
}): string | null {
  if (patch.meditation_duration_seconds != null) {
    const d = patch.meditation_duration_seconds
    if (!Number.isFinite(d) || d < DURATION_MIN || d > DURATION_MAX) {
      return `Duration must be between ${DURATION_MIN} and ${DURATION_MAX} seconds`
    }
    if (d % DURATION_STEP !== 0) {
      return `Duration must be a multiple of ${DURATION_STEP} seconds`
    }
  }
  if (patch.meditation_daily_limit != null) {
    const l = patch.meditation_daily_limit
    if (!Number.isFinite(l) || l < LIMIT_MIN || l > LIMIT_MAX || l % 1 !== 0) {
      return `Daily limit must be an integer between ${LIMIT_MIN} and ${LIMIT_MAX}`
    }
  }
  return null
}

export async function savePreferences(
  userId: string,
  patch: {
    meditation_duration_seconds?: number
    meditation_daily_limit?: number
    source_preference_conflicts?: SourceConflictPreference
  },
): Promise<ObsessionPreferencesRow> {
  const invalid = validatePreferencesPatch(patch)
  if (invalid) throw new Error(invalid)
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
