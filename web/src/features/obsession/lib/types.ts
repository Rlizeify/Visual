// Obsession — row types matching the public.obsession_* tables in
// migration 20260525120000_obsession_tables.sql.

export interface ObsessionMeditationRow {
  id: string
  user_id: string
  body: string
  tags: string[]
  session_started_at: string
  session_ended_at: string
  day_of_entry: string
  created_at: string
}

export interface ObsessionMeditationDraftRow {
  id: string
  user_id: string
  body: string
  started_at: string
  day_of_entry: string
  last_updated_at: string
}

export type ObsessionGoalKind = '5k' | 'half' | 'full' | 'ironman' | 'custom'

export interface ObsessionTrainingGoalRow {
  id: string
  user_id: string
  name: string
  target_date: string | null
  kind: ObsessionGoalKind
  notes: string
  achieved_at: string | null
  created_at: string
}

export interface ObsessionLiftsSessionRow {
  id: string
  user_id: string
  session_date: string
  notes: string
  created_at: string
}

export interface ObsessionLiftsExerciseRow {
  id: string
  user_id: string
  name: string
  up_arrow_flag: boolean
  last_session_id: string | null
  created_at: string
}

export type ObsessionStopReason = 'W' | 'P' | 'V' | 'F'
export type ObsessionIntensity = 0 | 1 | 2

export interface ObsessionLiftsSetRow {
  id: string
  user_id: string
  session_id: string
  exercise_name: string
  weight: number
  reps: number
  stop_reason: ObsessionStopReason
  intensity: 0 | 1 | 2
  pain_location: string | null
  set_order: number
  created_at: string
}

export interface ObsessionStravaTokenRow {
  user_id: string
  access_token: string
  refresh_token: string
  expires_at: string
  scope: string | null
  athlete_id: number | null
  created_at: string
  updated_at: string
}

export interface ObsessionStravaActivityRow {
  id: string
  user_id: string
  strava_id: number
  type: string
  distance: number | null
  moving_time: number | null
  elapsed_time: number | null
  started_at: string
  raw_payload: Record<string, unknown> | null
  ingested_at: string
}

export interface ObsessionMyNetDiaryEntryRow {
  id: string
  user_id: string
  entry_date: string
  food_name: string
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  raw_csv_row: Record<string, unknown> | null
  ingested_at: string
  upload_batch: string | null
}

export type SourceConflictPreference = 'strava' | 'mynetdiary' | 'ask'

export interface ObsessionPreferencesRow {
  user_id: string
  meditation_duration_seconds: number
  meditation_daily_limit: number
  source_preference_conflicts: SourceConflictPreference
  created_at: string
  updated_at: string
}

export interface ObsessionQuotePoolRow {
  id: string
  quote_text: string
  created_at: string
}

export const DEFAULT_MEDITATION_DURATION_SECONDS = 420
export const DEFAULT_MEDITATION_DAILY_LIMIT = 1
export const DEFAULT_SOURCE_PREFERENCE: SourceConflictPreference = 'ask'
