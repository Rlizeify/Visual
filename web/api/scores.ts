// Scores API (merged leaderboard + user-scores + score-events)
// Routes:
//   GET - list scores for leaderboard (public)
//   POST - upsert user score (requires auth)
//   GET ?action=user-scores - get user's position/velocity/acceleration/jerk/snap
//   GET ?action=events - get social feed events
//
// NOTE: Position scoring now uses the new connector-based engine.
// See web/api/scoring/engine.ts for the formula:
// - Position is 0-200 scale with soft cap at 100
// - Derivatives are z-scores against user's own historical baseline
// - Field values come from connectors (Spotify, Discord, etc.)

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getSupabase } from './_db.js'
import { getSpotifyId } from './_auth.js'
import { fetchAll, getActiveFields, type TimeScale } from '../src/scoring/connectors/index.js'
import { calculateScores as runScoringEngine, type FieldWeight, type PositionHistoryEntry, type ScoringOutput } from '../src/scoring/engine.js'

const PAGE_SIZE = 50
const VALID_TIME_SCALES = ['day', 'week', 'month'] as const
const RATE_LIMIT_MINUTES = 5 // 5 min lock per user

function getServiceSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase config')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

interface UserScoresResponse {
  position: number | null
  velocity: number | null
  acceleration: number | null
  jerk: number | null
  snap: number | null
  prestigeTier: number
  isPrestige: boolean
  rawScore: number
  last_updated: string | null
}

/**
 * Fetch field weights from the database.
 */
async function fetchWeights(
  supabase: ReturnType<typeof getServiceSupabase>
): Promise<Record<string, FieldWeight>> {
  const { data, error } = await supabase
    .from('scoring_field_weights')
    .select('field_id, weight, effort_multiplier')

  if (error) {
    console.error('[scores] Failed to fetch weights:', error)
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
 * Fetch position history for z-score calculation.
 */
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

  if (error) {
    console.error('[scores] Failed to fetch history:', error)
    return []
  }

  return (data || []).map(row => ({
    position: Number(row.position),
    computed_at: row.computed_at,
  }))
}

/**
 * Calculate scores using the new connector-based engine.
 */
async function calculateUserScores(
  supabase: ReturnType<typeof getServiceSupabase>,
  userId: string,
  timeScale: TimeScale
): Promise<ScoringOutput> {
  // Fetch field values from connectors
  const fieldValues = await fetchAll(userId, timeScale)

  // Fetch weights from database
  const weights = await fetchWeights(supabase)

  // Fetch history for z-score calculation
  const history = await fetchHistory(supabase, userId, timeScale)

  // Get active field metadata
  const fieldMetadata = getActiveFields()

  // Run the scoring engine
  return runScoringEngine({
    fieldValues,
    weights,
    fieldMetadata,
    history,
    timeScale,
  })
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

/**
 * Check if recomputation is allowed (not rate-limited).
 */
async function checkRateLimit(
  supabase: ReturnType<typeof getServiceSupabase>,
  userId: string
): Promise<{ allowed: boolean; lastComputed: Date | null }> {
  const { data, error } = await supabase
    .from('recompute_locks')
    .select('last_computed_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[scores] Rate limit check failed:', error)
    return { allowed: true, lastComputed: null }
  }

  if (!data) {
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
  supabase: ReturnType<typeof getServiceSupabase>,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('recompute_locks')
    .upsert({
      user_id: userId,
      last_computed_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) {
    console.error('[scores] Failed to update rate limit lock:', error)
  }
}

/**
 * Write new position to history.
 */
async function writeHistory(
  supabase: ReturnType<typeof getServiceSupabase>,
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
    console.error('[scores] Failed to write history:', error)
  }
}

/**
 * Write score_events for any changed scores and update user_scores.
 * Uses the new connector-based scoring engine.
 *
 * CHANGE DETECTION:
 * - Compares new scores against stored values in user_scores
 * - Only writes events when at least one score actually changed
 * - For initial calculation, delta = new value (no prior data)
 * - Never writes delta=0 events
 */
async function writeScoreEventsIfChanged(
  supabase: ReturnType<typeof getServiceSupabase>,
  userId: string,
  newScores: ScoringOutput
): Promise<{ eventsWritten: number; scoresChanged: boolean }> {
  // Get current scores for comparison
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

  // Compare each score and create events for changes
  for (const scoreType of SCORE_TYPES) {
    const newVal = newScores[scoreType]
    const oldVal = old[`${scoreType}_score` as keyof StoredScores]

    // Skip if new value is null
    if (newVal === null) continue

    // Calculate delta - compare against prior value, not zero
    let delta: number
    if (isInitial) {
      delta = newVal // First calculation - delta is the new value
    } else if (oldVal !== null) {
      delta = newVal - oldVal // Normal case - diff from prior
    } else {
      delta = newVal // Prior was null, new is not - treat as delta
    }

    // Round for comparison (avoid floating point noise)
    delta = Math.round(delta * 100) / 100

    // Never write delta=0 events - no change means no event
    if (delta === 0) continue

    events.push({
      user_id: userId,
      score_type: scoreType,
      delta,
      source_action: isInitial ? 'initial_calculation' : 'score_update',
    })
  }

  const scoresChanged = events.length > 0

  // Only write events if there are actual changes
  if (scoresChanged) {
    await supabase.from('score_events').insert(events)
  }

  // Only update user_scores if scores changed OR this is initial
  if (scoresChanged || isInitial) {
    const { error } = await supabase
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

    if (error) {
      console.error('[scores] Failed to update user_scores:', error)
    }
  }

  return { eventsWritten: events.length, scoresChanged }
}

// GET ?action=user-scores - user's derivative scores (read-only)
// Uses the new connector-based scoring engine (see web/api/scoring/engine.ts)
// NOTE: This endpoint does NOT trigger recomputes. Recomputes happen via cron job.
async function handleUserScores(req: VercelRequest, res: VercelResponse) {
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

  // Parse time scale from query, default to 'week'
  const timeScaleParam = req.query.timeScale as string | undefined
  const timeScale: TimeScale = VALID_TIME_SCALES.includes(timeScaleParam as TimeScale)
    ? (timeScaleParam as TimeScale)
    : 'week'

  // Read existing scores from database (no recompute here)
  const { data: storedScores } = await supabase
    .from('user_scores')
    .select('position_score, velocity_score, acceleration_score, jerk_score, snap_score, prestige_tier, is_prestige, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  // If no stored scores, calculate fresh (first-time user)
  let scores: ScoringOutput
  if (!storedScores) {
    scores = await calculateUserScores(supabase, userId, timeScale)
    // Write initial scores (no rate limit for first calculation)
    await writeScoreEventsIfChanged(supabase, userId, scores)
  } else {
    // Use stored scores
    scores = {
      position: storedScores.position_score ?? 0,
      velocity: storedScores.velocity_score ?? null,
      acceleration: storedScores.acceleration_score ?? null,
      jerk: storedScores.jerk_score ?? null,
      snap: storedScores.snap_score ?? null,
      rawScore: 0, // Not stored, but not needed for display
      isPrestige: storedScores.is_prestige ?? false,
      prestigeTier: storedScores.prestige_tier ?? 0,
    }
  }

  // Get tooltips
  const { data: defaultTooltips } = await supabase
    .from('tooltip_defaults')
    .select('score_type, text')

  const { data: userOverrides } = await supabase
    .from('tooltip_overrides')
    .select('score_type, text')
    .eq('user_id', userId)

  const { data: visibility } = await supabase
    .from('user_score_visibility')
    .select('score_type, reveal_action')
    .eq('user_id', userId)

  // Merge tooltips
  const tooltips: Record<string, string> = {}
  for (const t of defaultTooltips || []) {
    tooltips[t.score_type] = t.text
  }
  for (const t of userOverrides || []) {
    tooltips[t.score_type] = t.text
  }

  const visibilityMap: Record<string, boolean> = {}
  for (const v of visibility || []) {
    visibilityMap[v.score_type] = v.reveal_action
  }

  // Return response with new scoring engine output
  const response: UserScoresResponse = {
    position: scores.position,
    velocity: scores.velocity,
    acceleration: scores.acceleration,
    jerk: scores.jerk,
    snap: scores.snap,
    prestigeTier: scores.prestigeTier,
    isPrestige: scores.isPrestige,
    rawScore: scores.rawScore,
    last_updated: new Date().toISOString(),
  }

  return res.status(200).json({ scores: response, tooltips, visibility: visibilityMap, timeScale })
}

// GET ?action=events - social feed
async function handleEvents(req: VercelRequest, res: VercelResponse) {
  const supabase = getServiceSupabase()

  let currentUserId: string | null = null
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const { data: userData } = await supabase.auth.getUser(token)
    currentUserId = userData?.user?.id ?? null
  }

  const { data: events, error } = await supabase
    .from('score_events')
    .select(`
      id, user_id, score_type, delta, source_action, visibility_override, created_at,
      profiles(username, display_name)
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  const userIds = [...new Set((events || []).map(e => e.user_id))]
  const { data: visibilityData } = await supabase
    .from('user_score_visibility')
    .select('user_id, score_type, reveal_action')
    .in('user_id', userIds)

  const visibilityMap: Record<string, Record<string, boolean>> = {}
  for (const v of visibilityData || []) {
    if (!visibilityMap[v.user_id]) visibilityMap[v.user_id] = {}
    visibilityMap[v.user_id][v.score_type] = v.reveal_action
  }

  const feedEvents = (events || []).map(e => {
    const profile = e.profiles as { username?: string | null; display_name?: string | null } | null
    const isOwnEvent = currentUserId === e.user_id
    const userVisibility = visibilityMap[e.user_id]?.[e.score_type] ?? false
    const showSource = isOwnEvent && (e.visibility_override ?? userVisibility)

    return {
      id: e.id,
      username: profile?.username || profile?.display_name || 'Anonymous',
      score_type: e.score_type,
      delta: e.delta,
      direction: e.delta > 0 ? 'up' : e.delta < 0 ? 'down' : 'same',
      source_action: showSource ? e.source_action : null,
      created_at: e.created_at,
    }
  })

  return res.status(200).json({ events: feedEvents })
}

// GET - leaderboard
async function handleLeaderboard(req: VercelRequest, res: VercelResponse) {
  let supabase
  try {
    supabase = getSupabase()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Database configuration error'
    return res.status(500).json({ error: msg })
  }

  const page = parseInt(String(req.query.page || '1'), 10)
  const offset = (page - 1) * PAGE_SIZE

  const { data, error, count } = await supabase
    .from('user_scores')
    .select('spotify_user_id, display_name, score, listening_minutes, top_genre, updated_at', { count: 'exact' })
    .order('score', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  return res.status(200).json({
    scores: data || [],
    total: count || 0,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil((count || 0) / PAGE_SIZE),
  })
}

// POST ?action=recompute - full recomputation pipeline
async function handleRecompute(req: VercelRequest, res: VercelResponse) {
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

    interface RecomputeResult {
      timeScale: TimeScale
      scores: ScoringOutput
      changed: boolean
    }

    // Recompute for all time scales
    const results: RecomputeResult[] = []
    for (const timeScale of VALID_TIME_SCALES) {
      const fieldValues = await fetchAll(userId, timeScale)
      const history = await fetchHistory(supabase, userId, timeScale)
      const fieldMetadata = getActiveFields()

      const scores = runScoringEngine({
        fieldValues,
        weights,
        fieldMetadata,
        history,
        timeScale,
      })

      await writeHistory(supabase, userId, timeScale, scores)

      const changed = history.length === 0 || history[0].position !== scores.position
      results.push({ timeScale, scores, changed })
    }

    // Use week scores for user_scores and score_events (default time scale)
    const weekResult = results.find(r => r.timeScale === 'week')
    if (weekResult) {
      await writeScoreEventsIfChanged(supabase, userId, weekResult.scores)
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
    console.error('[scores] Recompute error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

// POST - upsert score
async function handleUpsertScore(req: VercelRequest, res: VercelResponse) {
  let supabase
  try {
    supabase = getSupabase()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Database configuration error'
    return res.status(500).json({ error: msg })
  }

  const spotify_id = getSpotifyId(req, res)
  if (!spotify_id) return

  const { display_name, listening_minutes, top_genre } = req.body

  if (!display_name || typeof display_name !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid display_name' })
  }

  const score = typeof listening_minutes === 'number' ? listening_minutes : 0

  const { error } = await supabase
    .from('user_scores')
    .upsert(
      {
        spotify_user_id: spotify_id,
        display_name,
        score,
        listening_minutes: listening_minutes || 0,
        top_genre: top_genre || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'spotify_user_id' }
    )

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  return res.status(200).json({ ok: true })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action as string | undefined

  if (req.method === 'GET') {
    if (action === 'user-scores') {
      return handleUserScores(req, res)
    }
    if (action === 'events') {
      return handleEvents(req, res)
    }
    return handleLeaderboard(req, res)
  }

  if (req.method === 'POST') {
    if (action === 'recompute') {
      return handleRecompute(req, res)
    }
    return handleUpsertScore(req, res)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
