/**
 * Cron job: daily score recompute with server-side Spotify ingestion.
 *
 * Schedule: `0 0 * * *` (vercel.json) — Vercel Hobby tier allows daily
 * only. For on-demand runs use `POST /api/scores?action=recompute-all`
 * with `Authorization: Bearer ${CRON_SECRET}`.
 *
 * For every user with a row in `public.spotify_tokens`:
 *   1. Refresh access_token if expired (PKCE refresh, deletes row on
 *      400/401 = revoked).
 *   2. Fetch /v1/me/player/recently-played and upsert into
 *      `spotify_play_history` + `user_listening_stats`.
 *   3. Run the scoring engine (week scale) and write
 *      `user_scores` / `score_events` / `user_position_history`.
 *
 * Per-user errors never abort the loop (try/catch wraps each step).
 * Idempotent — duplicate plays collide on (user_id, track_id,
 * played_at); aggregates use max(existing, new).
 *
 * Also pings the `keepalive` heartbeat once per run to keep the
 * Supabase free tier alive (folded in to stay under 12 functions —
 * see .claude/memory/context/supabase-keepalive.md).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { fetchAll, getActiveFields, type TimeScale } from '../../src/scoring/connectors/index.js'
import { calculateScores, type FieldWeight, type PositionHistoryEntry, type ScoringOutput } from '../../src/scoring/engine.js'
import { forEachLinkedUser, syncRecentlyPlayed } from '../_spotify-ingestion.js'

function getServiceSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase config')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

const SCORE_TYPES = ['position', 'velocity', 'acceleration', 'jerk', 'snap'] as const
type ScoreType = typeof SCORE_TYPES[number]

interface StoredScores {
  position_score: number | null
  velocity_score: number | null
  acceleration_score: number | null
  jerk_score: number | null
  snap_score: number | null
}

async function fetchWeights(supabase: SupabaseClient): Promise<Record<string, FieldWeight>> {
  const { data, error } = await supabase
    .from('scoring_field_weights')
    .select('field_id, weight, effort_multiplier')
  if (error) {
    console.error('[cron] Failed to fetch weights:', error)
    return {}
  }
  const weights: Record<string, FieldWeight> = {}
  for (const row of data ?? []) {
    weights[row.field_id] = {
      weight: row.weight,
      effortMultiplier: row.effort_multiplier,
    }
  }
  return weights
}

async function fetchHistory(
  supabase: SupabaseClient,
  userId: string,
  timeScale: TimeScale,
): Promise<PositionHistoryEntry[]> {
  const { data, error } = await supabase
    .from('user_position_history')
    .select('position, computed_at')
    .eq('user_id', userId)
    .eq('time_scale', timeScale)
    .order('computed_at', { ascending: false })
    .limit(30)
  if (error) return []
  return (data ?? []).map(row => ({
    position: Number(row.position),
    computed_at: row.computed_at,
  }))
}

async function writeScoreEventsIfChanged(
  supabase: SupabaseClient,
  userId: string,
  newScores: ScoringOutput,
): Promise<number> {
  const { data: current } = await supabase
    .from('user_scores')
    .select('user_id, position_score, velocity_score, acceleration_score, jerk_score, snap_score')
    .eq('user_id', userId)
    .maybeSingle()

  const old: StoredScores = {
    position_score: current?.position_score ?? null,
    velocity_score: current?.velocity_score ?? null,
    acceleration_score: current?.acceleration_score ?? null,
    jerk_score: current?.jerk_score ?? null,
    snap_score: current?.snap_score ?? null,
  }
  const isInitial = current === null
  const events: Array<{ user_id: string; score_type: ScoreType; delta: number; source_action: string }> = []

  for (const scoreType of SCORE_TYPES) {
    const newVal = newScores[scoreType]
    const oldVal = old[`${scoreType}_score` as keyof StoredScores]
    if (newVal === null) continue
    let delta: number
    if (isInitial) delta = newVal
    else if (oldVal !== null) delta = newVal - oldVal
    else delta = newVal
    delta = Math.round(delta * 100) / 100
    if (delta === 0) continue
    events.push({
      user_id: userId,
      score_type: scoreType,
      delta,
      source_action: isInitial ? 'initial_calculation' : 'cron_recompute',
    })
  }

  if (events.length > 0) await supabase.from('score_events').insert(events)

  if (events.length > 0 || isInitial) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('username, display_name')
      .eq('id', userId)
      .maybeSingle()
    const displayName = prof?.display_name || prof?.username || 'User'

    // spotify_user_id is now nullable (mig 20260530000002). Don't write a
    // placeholder; leave any existing value untouched on conflict.
    const { error: upsertErr } = await supabase
      .from('user_scores')
      .upsert({
        user_id: userId,
        display_name: displayName,
        position_score: newScores.position,
        velocity_score: newScores.velocity,
        acceleration_score: newScores.acceleration,
        jerk_score: newScores.jerk,
        snap_score: newScores.snap,
        prestige_tier: newScores.prestigeTier,
        is_prestige: newScores.isPrestige,
        score: newScores.position,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (upsertErr) {
      console.error('[cron] user_scores upsert failed', {
        user_id: userId, error: upsertErr.message, code: upsertErr.code,
      })
    } else {
      console.log('[cron] user_scores upserted', {
        user_id: userId, position: newScores.position, eventsWritten: events.length,
      })
    }
  }

  return events.length
}

async function writeHistory(
  supabase: SupabaseClient,
  userId: string,
  timeScale: TimeScale,
  scores: ScoringOutput,
): Promise<void> {
  await supabase.from('user_position_history').insert({
    user_id: userId,
    time_scale: timeScale,
    position: scores.position,
    raw_score: scores.rawScore,
    computed_at: new Date().toISOString(),
  })
}

async function updateRateLimitLock(supabase: SupabaseClient, userId: string): Promise<void> {
  await supabase
    .from('recompute_locks')
    .upsert({
      user_id: userId,
      last_computed_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
}

async function pingKeepalive(supabase: SupabaseClient): Promise<void> {
  try {
    const { data } = await supabase
      .from('keepalive')
      .select('ping_count')
      .eq('id', 1)
      .maybeSingle()
    const nextCount = (data?.ping_count ?? 0) + 1
    await supabase
      .from('keepalive')
      .update({ last_pinged_at: new Date().toISOString(), ping_count: nextCount })
      .eq('id', 1)
  } catch (err) {
    console.warn('[cron] keepalive ping failed:', err)
  }
}

/**
 * Per-user pipeline: fresh access_token already supplied by
 * forEachLinkedUser. Runs ingestion + scoring for the week scale.
 * Day and month scales scored too — engine math is cheap, useful for
 * future UI surfaces.
 */
export async function recomputeUserFromSpotify(
  supabase: SupabaseClient,
  userId: string,
  accessToken: string,
  source: 'cron_recompute' | 'manual_recompute_all' = 'cron_recompute',
): Promise<{ ingested: number; eventsWritten: number; position: number }> {
  // Step 1: ingest
  const sync = await syncRecentlyPlayed(supabase, userId, accessToken)
  if (!sync.ok && sync.status === 403) {
    console.warn(`[cron] user ${userId}: 403 from recently-played — likely missing user-read-recently-played scope (re-link required)`)
  }

  // Step 2: score (week scale drives events; day + month written for history)
  const weights = await fetchWeights(supabase)
  const fieldMetadata = getActiveFields()
  let weekScores: ScoringOutput | null = null
  for (const timeScale of ['day', 'week', 'month'] as const) {
    const fieldValues = await fetchAll(userId, timeScale)
    const history = await fetchHistory(supabase, userId, timeScale)
    const scores = calculateScores({ fieldValues, weights, fieldMetadata, history, timeScale })
    await writeHistory(supabase, userId, timeScale, scores)
    if (timeScale === 'week') weekScores = scores
  }

  // Step 3: emit events + upsert user_scores
  let eventsWritten = 0
  if (weekScores) {
    eventsWritten = await writeScoreEventsIfChanged(supabase, userId, weekScores)
  }
  await updateRateLimitLock(supabase, userId)

  return {
    ingested: sync.inserted,
    eventsWritten,
    position: weekScores?.position ?? 0,
  }
  void source  // reserved for future provenance tagging
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel cron sends Authorization: Bearer ${CRON_SECRET}.
  const cronSecret = req.headers['authorization']
  const expectedSecret = process.env.CRON_SECRET
  if (process.env.NODE_ENV === 'production' && expectedSecret && cronSecret !== `Bearer ${expectedSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const t0 = Date.now()
  console.log('[cron] recompute start', { at: new Date(t0).toISOString() })

  const supabase = getServiceSupabase()
  await pingKeepalive(supabase)

  let totalIngested = 0
  let totalEvents = 0

  const counts = await forEachLinkedUser(
    supabase,
    async (userId, accessToken) => {
      const { ingested, eventsWritten } = await recomputeUserFromSpotify(supabase, userId, accessToken)
      totalIngested += ingested
      totalEvents += eventsWritten
    },
    (msg, extra) => console.log(`[cron] ${msg}`, extra ?? ''),
  )

  const elapsedMs = Date.now() - t0
  console.log('[cron] recompute done', { elapsedMs, totalIngested, totalEvents, ...counts })

  return res.status(200).json({
    ok: true,
    elapsedMs,
    plays_ingested: totalIngested,
    events_written: totalEvents,
    ...counts,
  })
}
