/**
 * Scoring Recompute Pipeline
 *
 * POST /api/scoring/recompute
 *
 * Triggers a full recomputation of a user's scores across all time scales.
 * Rate-limited to once per 10 minutes per user.
 *
 * Trigger conditions:
 * - User lands on U-tab
 * - Spotify token refreshes
 *
 * Process:
 * 1. Check rate limit (recompute_locks table)
 * 2. For each time scale (day, week, month, all):
 *    a. Fetch field values from connectors
 *    b. Fetch weights from scoring_field_weights
 *    c. Fetch history from user_position_history
 *    d. Run scoring engine
 *    e. Write new position to user_position_history
 * 3. Update user_scores with latest values
 * 4. Write score_events for any changes
 * 5. Update recompute_locks timestamp
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { fetchAll, getActiveFields, type TimeScale } from './connectors/index.js'
import { calculateScores, type FieldWeight, type PositionHistoryEntry, type ScoringOutput } from './engine.js'

const RATE_LIMIT_MINUTES = 10
const TIME_SCALES: TimeScale[] = ['day', 'week', 'month']

function getServiceSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase config')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

interface RecomputeResult {
  timeScale: TimeScale
  scores: ScoringOutput
  changed: boolean
}

/**
 * Check if recomputation is allowed (not rate-limited).
 */
async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string
): Promise<{ allowed: boolean; lastComputed: Date | null }> {
  const { data, error } = await supabase
    .from('recompute_locks')
    .select('last_computed_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[recompute] Rate limit check failed:', error)
    // Allow on error (fail open)
    return { allowed: true, lastComputed: null }
  }

  if (!data) {
    // No lock row = never computed = allowed
    return { allowed: true, lastComputed: null }
  }

  const lastComputed = new Date(data.last_computed_at)
  const now = new Date()
  const minutesSince = (now.getTime() - lastComputed.getTime()) / 60000

  return {
    allowed: minutesSince >= RATE_LIMIT_MINUTES,
    lastComputed,
  }
}

/**
 * Update the rate limit lock timestamp.
 */
async function updateRateLimitLock(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('recompute_locks')
    .upsert({
      user_id: userId,
      last_computed_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) {
    console.error('[recompute] Failed to update rate limit lock:', error)
  }
}

/**
 * Fetch field weights from the database.
 */
async function fetchWeights(
  supabase: SupabaseClient
): Promise<Record<string, FieldWeight>> {
  const { data, error } = await supabase
    .from('scoring_field_weights')
    .select('field_id, weight, effort_multiplier')

  if (error) {
    console.error('[recompute] Failed to fetch weights:', error)
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

/**
 * Fetch position history for a user at a time scale.
 */
async function fetchHistory(
  supabase: SupabaseClient,
  userId: string,
  timeScale: TimeScale
): Promise<PositionHistoryEntry[]> {
  const { data, error } = await supabase
    .from('user_position_history')
    .select('position, computed_at')
    .eq('user_id', userId)
    .eq('time_scale', timeScale)
    .order('computed_at', { ascending: false })
    .limit(30) // Enough for z-score calculation

  if (error) {
    console.error('[recompute] Failed to fetch history:', error)
    return []
  }

  return (data || []).map(row => ({
    position: Number(row.position),
    computed_at: row.computed_at,
  }))
}

/**
 * Write new position to history.
 */
async function writeHistory(
  supabase: SupabaseClient,
  userId: string,
  timeScale: TimeScale,
  scores: ScoringOutput
): Promise<void> {
  const { error } = await supabase
    .from('user_position_history')
    .insert({
      user_id: userId,
      time_scale: timeScale,
      position: scores.position,
      raw_score: scores.rawScore,
      computed_at: new Date().toISOString(),
    })

  if (error) {
    console.error('[recompute] Failed to write history:', error)
  }
}

/**
 * Update user_scores with latest values.
 */
async function updateUserScores(
  supabase: SupabaseClient,
  userId: string,
  weekScores: ScoringOutput
): Promise<{ old: Record<string, number | null>; error: Error | null }> {
  // Fetch current scores for comparison
  const { data: current } = await supabase
    .from('user_scores')
    .select('user_id, position_score, velocity_score, acceleration_score, jerk_score, snap_score')
    .eq('user_id', userId)
    .maybeSingle()

  const old: Record<string, number | null> = {
    position: current?.position_score ?? null,
    velocity: current?.velocity_score ?? null,
    acceleration: current?.acceleration_score ?? null,
    jerk: current?.jerk_score ?? null,
    snap: current?.snap_score ?? null,
  }

  // Update or insert scores
  const { error } = await supabase
    .from('user_scores')
    .upsert({
      user_id: userId,
      position_score: weekScores.position,
      velocity_score: weekScores.velocity,
      acceleration_score: weekScores.acceleration,
      jerk_score: weekScores.jerk,
      snap_score: weekScores.snap,
      prestige_tier: weekScores.prestigeTier,
      is_prestige: weekScores.isPrestige,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) {
    console.error('[recompute] Failed to update user_scores:', error)
    return { old, error }
  }

  return { old, error: null }
}

/**
 * Write score_events for any changed scores.
 */
async function writeScoreEvents(
  supabase: SupabaseClient,
  userId: string,
  oldScores: Record<string, number | null>,
  newScores: ScoringOutput
): Promise<void> {
  const scoreTypes = ['position', 'velocity', 'acceleration', 'jerk', 'snap'] as const
  const events: Array<{
    user_id: string
    score_type: string
    delta: number
    source_action: string
  }> = []

  for (const scoreType of scoreTypes) {
    const newVal = newScores[scoreType]
    const oldVal = oldScores[scoreType]

    // Skip if new value is null
    if (newVal === null) continue

    // Calculate delta
    const isInitial = oldVal === null
    const delta = isInitial ? newVal : newVal - oldVal

    // Only write if there's a change
    if (delta === 0 && !isInitial) continue

    events.push({
      user_id: userId,
      score_type: scoreType,
      delta: Math.round(delta * 100) / 100,
      source_action: isInitial ? 'initial_calculation' : 'recompute',
    })
  }

  if (events.length > 0) {
    const { error } = await supabase.from('score_events').insert(events)
    if (error) {
      console.error('[recompute] Failed to write score_events:', error)
    }
  }
}

/**
 * Run recomputation for a single time scale.
 */
async function recomputeForTimeScale(
  supabase: SupabaseClient,
  userId: string,
  timeScale: TimeScale,
  weights: Record<string, FieldWeight>
): Promise<RecomputeResult> {
  // Fetch field values from connectors
  const fieldValues = await fetchAll(userId, timeScale)

  // Fetch history for z-score calculation
  const history = await fetchHistory(supabase, userId, timeScale)

  // Get field metadata
  const fieldMetadata = getActiveFields()

  // Run scoring engine
  const scores = calculateScores({
    fieldValues,
    weights,
    fieldMetadata,
    history,
    timeScale,
  })

  // Write to history
  await writeHistory(supabase, userId, timeScale, scores)

  // Check if position changed from last entry
  const changed = history.length === 0 || history[0].position !== scores.position

  return { timeScale, scores, changed }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Verify authentication
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization' })
  }

  const token = authHeader.slice(7)
  const supabase = getServiceSupabase()

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  const userId = userData.user.id

  // Check rate limit
  const { allowed, lastComputed } = await checkRateLimit(supabase, userId)
  if (!allowed) {
    const minutesRemaining = RATE_LIMIT_MINUTES - Math.floor(
      (Date.now() - (lastComputed?.getTime() || 0)) / 60000
    )
    return res.status(429).json({
      error: 'Rate limited',
      message: `Please wait ${minutesRemaining} minutes before recomputing`,
      retry_after: minutesRemaining * 60,
    })
  }

  try {
    // Fetch weights once (same for all time scales)
    const weights = await fetchWeights(supabase)

    // Recompute for all time scales
    const results: RecomputeResult[] = []
    for (const timeScale of TIME_SCALES) {
      const result = await recomputeForTimeScale(supabase, userId, timeScale, weights)
      results.push(result)
    }

    // Use week scores for user_scores and score_events (default time scale)
    const weekResult = results.find(r => r.timeScale === 'week')
    if (weekResult) {
      const { old } = await updateUserScores(supabase, userId, weekResult.scores)
      await writeScoreEvents(supabase, userId, old, weekResult.scores)
    }

    // Update rate limit lock
    await updateRateLimitLock(supabase, userId)

    return res.status(200).json({
      ok: true,
      results: results.map(r => ({
        timeScale: r.timeScale,
        position: r.scores.position,
        velocity: r.scores.velocity,
        acceleration: r.scores.acceleration,
        jerk: r.scores.jerk,
        snap: r.scores.snap,
        prestigeTier: r.scores.prestigeTier,
        changed: r.changed,
      })),
    })
  } catch (error) {
    console.error('[recompute] Unexpected error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * Export for use by other endpoints (e.g., Spotify token refresh).
 */
export async function triggerRecompute(userId: string): Promise<void> {
  const supabase = getServiceSupabase()

  const { allowed } = await checkRateLimit(supabase, userId)
  if (!allowed) {
    console.log(`[recompute] Skipping recompute for ${userId} (rate limited)`)
    return
  }

  const weights = await fetchWeights(supabase)

  for (const timeScale of TIME_SCALES) {
    await recomputeForTimeScale(supabase, userId, timeScale, weights)
  }

  const weekResult = await recomputeForTimeScale(supabase, userId, 'week', weights)
  const { old } = await updateUserScores(supabase, userId, weekResult.scores)
  await writeScoreEvents(supabase, userId, old, weekResult.scores)

  await updateRateLimitLock(supabase, userId)
}
