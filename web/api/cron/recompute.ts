/**
 * Cron job: Background score recompute
 *
 * Runs every 5 minutes via Vercel cron.
 * Iterates all users with a Spotify connection, checks if their last
 * recompute was > 5 minutes ago, and if so triggers a recompute.
 *
 * This is idempotent - running twice in a row produces no extra events
 * because change detection prevents duplicate writes.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { fetchAll, getActiveFields, type TimeScale } from '../../src/scoring/connectors/index.js'
import { calculateScores, type FieldWeight, type PositionHistoryEntry, type ScoringOutput } from '../../src/scoring/engine.js'

const RATE_LIMIT_MINUTES = 5

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

async function fetchWeights(supabase: ReturnType<typeof getServiceSupabase>): Promise<Record<string, FieldWeight>> {
  const { data, error } = await supabase
    .from('scoring_field_weights')
    .select('field_id, weight, effort_multiplier')

  if (error) {
    console.error('[cron] Failed to fetch weights:', error)
    return {}
  }

  const weights: Record<string, FieldWeight> = {}
  for (const row of data || []) {
    weights[row.field_id] = {
      weight: row.weight,
      effortMultiplier: row.effort_multiplier,
    }
  }
  return weights
}

async function fetchHistory(
  supabase: ReturnType<typeof getServiceSupabase>,
  userId: string,
  timeScale: TimeScale
): Promise<PositionHistoryEntry[]> {
  const { data, error } = await supabase
    .from('user_position_history')
    .select('position, computed_at')
    .eq('user_id', userId)
    .eq('time_scale', timeScale)
    .order('computed_at', { ascending: false })
    .limit(30)

  if (error) return []
  return (data || []).map(row => ({
    position: Number(row.position),
    computed_at: row.computed_at,
  }))
}

async function writeScoreEventsIfChanged(
  supabase: ReturnType<typeof getServiceSupabase>,
  userId: string,
  newScores: ScoringOutput
): Promise<{ eventsWritten: number; scoresChanged: boolean }> {
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
    if (isInitial) {
      delta = newVal
    } else if (oldVal !== null) {
      delta = newVal - oldVal
    } else {
      delta = newVal
    }

    delta = Math.round(delta * 100) / 100
    if (delta === 0) continue

    events.push({
      user_id: userId,
      score_type: scoreType,
      delta,
      source_action: isInitial ? 'initial_calculation' : 'cron_recompute',
    })
  }

  const scoresChanged = events.length > 0

  if (scoresChanged) {
    await supabase.from('score_events').insert(events)
  }

  if (scoresChanged || isInitial) {
    await supabase
      .from('user_scores')
      .upsert({
        user_id: userId,
        position_score: newScores.position,
        velocity_score: newScores.velocity,
        acceleration_score: newScores.acceleration,
        jerk_score: newScores.jerk,
        snap_score: newScores.snap,
        prestige_tier: newScores.prestigeTier,
        is_prestige: newScores.isPrestige,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
  }

  return { eventsWritten: events.length, scoresChanged }
}

async function writeHistory(
  supabase: ReturnType<typeof getServiceSupabase>,
  userId: string,
  timeScale: TimeScale,
  scores: ScoringOutput
): Promise<void> {
  await supabase
    .from('user_position_history')
    .insert({
      user_id: userId,
      time_scale: timeScale,
      position: scores.position,
      raw_score: scores.rawScore,
      computed_at: new Date().toISOString(),
    })
}

async function updateRateLimitLock(
  supabase: ReturnType<typeof getServiceSupabase>,
  userId: string
): Promise<void> {
  await supabase
    .from('recompute_locks')
    .upsert({
      user_id: userId,
      last_computed_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
}

// Supabase free-tier auto-pauses after 7 days of inactivity. This server-side
// keepalive is folded into the existing daily cron to stay under the Hobby
// 12-function limit; see .claude/memory/context/supabase-keepalive.md.
async function pingKeepalive(
  supabase: ReturnType<typeof getServiceSupabase>
): Promise<void> {
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret (Vercel sets this header for cron jobs)
  const cronSecret = req.headers['authorization']
  const expectedSecret = process.env.CRON_SECRET

  // In development, allow without secret. In production, require it.
  if (process.env.NODE_ENV === 'production' && expectedSecret && cronSecret !== `Bearer ${expectedSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = getServiceSupabase()

  // Always ping keepalive first — runs even if no users need recompute.
  await pingKeepalive(supabase)

  const now = new Date()
  const cutoff = new Date(now.getTime() - RATE_LIMIT_MINUTES * 60 * 1000)

  // Find users with Spotify connection who need recompute
  const { data: connections, error: connError } = await supabase
    .from('oauth_connections')
    .select('user_id')
    .eq('provider', 'spotify')

  if (connError) {
    console.error('[cron] Failed to fetch connections:', connError)
    return res.status(500).json({ error: connError.message })
  }

  const userIds = [...new Set((connections || []).map(c => c.user_id))]
  if (userIds.length === 0) {
    return res.status(200).json({ ok: true, processed: 0, message: 'No users with Spotify connection' })
  }

  // Check rate limits
  const { data: locks } = await supabase
    .from('recompute_locks')
    .select('user_id, last_computed_at')
    .in('user_id', userIds)

  const lockMap = new Map((locks || []).map(l => [l.user_id, new Date(l.last_computed_at)]))

  // Filter to users who need recompute (no lock or lock expired)
  const usersToProcess = userIds.filter(uid => {
    const lastComputed = lockMap.get(uid)
    return !lastComputed || lastComputed < cutoff
  })

  if (usersToProcess.length === 0) {
    return res.status(200).json({ ok: true, processed: 0, message: 'All users recently computed' })
  }

  // Fetch weights once for all users
  const weights = await fetchWeights(supabase)
  const fieldMetadata = getActiveFields()

  let processed = 0
  let eventsTotal = 0

  for (const userId of usersToProcess) {
    try {
      // Compute for week time scale (primary for events/leaderboard)
      const timeScale: TimeScale = 'week'
      const fieldValues = await fetchAll(userId, timeScale)
      const history = await fetchHistory(supabase, userId, timeScale)

      const scores = calculateScores({
        fieldValues,
        weights,
        fieldMetadata,
        history,
        timeScale,
      })

      // Write history entry
      await writeHistory(supabase, userId, timeScale, scores)

      // Write events if changed
      const { eventsWritten } = await writeScoreEventsIfChanged(supabase, userId, scores)
      eventsTotal += eventsWritten

      // Update rate limit lock
      await updateRateLimitLock(supabase, userId)

      processed++
    } catch (err) {
      console.error(`[cron] Failed to process user ${userId}:`, err)
    }
  }

  return res.status(200).json({
    ok: true,
    processed,
    eventsWritten: eventsTotal,
    totalUsers: userIds.length,
    skippedRateLimited: userIds.length - usersToProcess.length,
  })
}
