// Scores API (leaderboard + user-scores + score-events + recompute)
// Routes:
//   GET                          - public leaderboard
//   GET  ?action=user-scores     - current user's derivatives (auth)
//   GET  ?action=events          - social feed
//   POST ?action=recompute       - recompute for current user (auth, 5min lock)
//   POST ?action=recompute-stale - recompute any user whose row is >5min old (auth)
//
// Position scoring uses the connector-based engine in src/scoring/engine.ts.
// Spotify field values come from user_listening_stats + spotify_play_history,
// which this endpoint syncs from the live Spotify API before each recompute
// when the client passes a spotifyAccessToken.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getSupabase } from '../_db.js'
import { getSpotifyId } from '../_auth.js'
import { fetchAll, getActiveFields, type TimeScale } from '../../src/scoring/connectors/index.js'
import { calculateScores as runScoringEngine, type FieldWeight, type PositionHistoryEntry, type ScoringOutput } from '../../src/scoring/engine.js'
import { syncRecentlyPlayed, forEachLinkedUser } from '../_spotify-ingestion.js'

const PAGE_SIZE = 50
const VALID_TIME_SCALES = ['day', 'week', 'month'] as const
const RATE_LIMIT_MINUTES = 5

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

// Ingestion moved to `./_spotify-ingestion.ts` (`syncRecentlyPlayed`)
// so the daily cron and the client-triggered recompute share one
// implementation. See `.claude/memory/progress/scores-broken-audit.md`.

const SCORE_TYPES = ['position', 'velocity', 'acceleration', 'jerk', 'snap'] as const
type ScoreType = typeof SCORE_TYPES[number]

interface StoredScores {
  position_score: number | null
  velocity_score: number | null
  acceleration_score: number | null
  jerk_score: number | null
  snap_score: number | null
}

async function checkRateLimit(
  supabase: ReturnType<typeof getServiceSupabase>,
  userId: string
): Promise<{ allowed: boolean; lastComputed: Date | null }> {
  const { data, error } = await supabase
    .from('recompute_locks')
    .select('last_computed_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) return { allowed: true, lastComputed: null }
  if (!data) return { allowed: true, lastComputed: null }

  const lastComputed = new Date(data.last_computed_at)
  const minutesSince = (Date.now() - lastComputed.getTime()) / 60000
  return { allowed: minutesSince >= RATE_LIMIT_MINUTES, lastComputed }
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
    if (isInitial) delta = newVal
    else if (oldVal !== null) delta = newVal - oldVal
    else delta = newVal

    delta = Math.round(delta * 100) / 100
    if (delta === 0) continue

    events.push({
      user_id: userId,
      score_type: scoreType,
      delta,
      source_action: isInitial ? 'initial_calculation' : 'score_update',
    })
  }

  const scoresChanged = events.length > 0
  if (scoresChanged) await supabase.from('score_events').insert(events)

  if (scoresChanged || isInitial) {
    // Resolve display_name + spotify_user_id from users/profiles so the
    // public leaderboard row stays populated even when user has no spotify_id
    // recorded yet.
    const { data: prof } = await supabase
      .from('profiles')
      .select('username, display_name')
      .eq('id', userId)
      .maybeSingle()

    const displayName = prof?.display_name || prof?.username || 'User'

    // spotify_user_id is now nullable (migration 20260530000002); the previous
    // auth-UUID kludge to satisfy NOT NULL is no longer required. Leave it
    // alone on subsequent updates so legacy values aren't clobbered.
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
        score: newScores.position, // keep legacy `score` column in sync
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (upsertErr) {
      console.error('[scores] user_scores upsert failed', {
        user_id: userId, error: upsertErr.message, code: upsertErr.code,
      })
    } else {
      console.log('[scores] user_scores upserted', {
        user_id: userId, position: newScores.position, eventsWritten: events.length,
      })
    }
  }

  return { eventsWritten: events.length, scoresChanged }
}

async function recomputeUser(
  supabase: ReturnType<typeof getServiceSupabase>,
  userId: string,
  spotifyAccessToken?: string
): Promise<{ scores: ScoringOutput; synced: number; eventsWritten: number }> {
  let synced = 0
  if (spotifyAccessToken) {
    const sync = await syncRecentlyPlayed(supabase, userId, spotifyAccessToken)
    synced = sync.inserted
  }

  const weights = await fetchWeights(supabase)
  const fieldMetadata = getActiveFields()

  let weekResult: ScoringOutput | null = null
  for (const timeScale of VALID_TIME_SCALES) {
    const fieldValues = await fetchAll(userId, timeScale)
    const history = await fetchHistory(supabase, userId, timeScale)
    const scores = runScoringEngine({
      fieldValues, weights, fieldMetadata, history, timeScale,
    })
    await writeHistory(supabase, userId, timeScale, scores)
    if (timeScale === 'week') weekResult = scores
  }

  let eventsWritten = 0
  if (weekResult) {
    const r = await writeScoreEventsIfChanged(supabase, userId, weekResult)
    eventsWritten = r.eventsWritten
  }
  await updateRateLimitLock(supabase, userId)
  return { scores: weekResult!, synced, eventsWritten }
}

// GET ?action=user-scores
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

  const { data: storedScores } = await supabase
    .from('user_scores')
    .select('position_score, velocity_score, acceleration_score, jerk_score, snap_score, prestige_tier, is_prestige, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  const scores: ScoringOutput = storedScores
    ? {
        position: storedScores.position_score ?? 0,
        velocity: storedScores.velocity_score,
        acceleration: storedScores.acceleration_score,
        jerk: storedScores.jerk_score,
        snap: storedScores.snap_score,
        rawScore: 0,
        isPrestige: storedScores.is_prestige ?? false,
        prestigeTier: storedScores.prestige_tier ?? 0,
      }
    : { position: 0, velocity: null, acceleration: null, jerk: null, snap: null, rawScore: 0, isPrestige: false, prestigeTier: 0 }

  const { data: defaultTooltips } = await supabase.from('tooltip_defaults').select('score_type, text')
  const { data: userOverrides } = await supabase.from('tooltip_overrides').select('score_type, text').eq('user_id', userId)
  const { data: visibility } = await supabase.from('user_score_visibility').select('score_type, reveal_action').eq('user_id', userId)

  const tooltips: Record<string, string> = {}
  for (const t of defaultTooltips || []) tooltips[t.score_type] = t.text
  for (const t of userOverrides || []) tooltips[t.score_type] = t.text

  const visibilityMap: Record<string, boolean> = {}
  for (const v of visibility || []) visibilityMap[v.score_type] = v.reveal_action

  const response: UserScoresResponse = {
    position: scores.position,
    velocity: scores.velocity,
    acceleration: scores.acceleration,
    jerk: scores.jerk,
    snap: scores.snap,
    prestigeTier: scores.prestigeTier,
    isPrestige: scores.isPrestige,
    rawScore: scores.rawScore,
    last_updated: storedScores?.updated_at ?? null,
  }

  return res.status(200).json({ scores: response, tooltips, visibility: visibilityMap })
}

// GET ?action=events
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
      profiles(username, display_name, avatar_url, accent_color)
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return res.status(500).json({ error: error.message })

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
    const profile = e.profiles as { username?: string | null; display_name?: string | null; avatar_url?: string | null; accent_color?: string | null } | null
    const isOwnEvent = currentUserId === e.user_id
    const userVisibility = visibilityMap[e.user_id]?.[e.score_type] ?? false
    const showSource = isOwnEvent && (e.visibility_override ?? userVisibility)

    return {
      id: e.id,
      user_id: e.user_id,
      username: profile?.username || profile?.display_name || 'Anonymous',
      avatar_url: profile?.avatar_url ?? null,
      accent_color: profile?.accent_color ?? '#00dcc8',
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
// Returns rows from user_scores where user_id IS NOT NULL — i.e., only rows
// produced by the modern scoring pipeline (writeScoreEventsIfChanged), which
// upserts on the UNIQUE user_id key (migration 20260530000002).
//
// Why filter NULL user_id: user_scores carries two write paths. The legacy
// POST /api/scores upsert (handleUpsertScore) and the auth-signup flow at
// /api/auth keyed on the UNIQUE spotify_user_id with user_id left NULL. A
// single human therefore can have two physical rows — one legacy row keyed
// by spotify_user_id, one modern row keyed by user_id — which is why the
// leaderboard previously showed 2 users as 4 rows. There is no DB-level
// mapping between spotify_user_id and auth.uid, so we cannot fuse them.
// Filtering to user_id IS NOT NULL is the simplest correct dedup: modern
// rows are unique by user_id, and orphan legacy rows carry stale Spotify-
// only data that the modern path supersedes anyway.
//
// Profiles are fetched in a separate query rather than via PostgREST nested
// join because user_scores.user_id references auth.users(id) directly, not
// public.profiles(id) (no FK PostgREST can follow). Doing the join in JS
// keeps the endpoint working regardless of FK-migration state.
async function handleLeaderboard(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabase()

  const page = parseInt(String(req.query.page || '1'), 10)
  const offset = (page - 1) * PAGE_SIZE

  const { data, error, count } = await supabase
    .from('user_scores')
    .select(`
      user_id, spotify_user_id, display_name,
      position_score, velocity_score, acceleration_score, jerk_score, snap_score,
      prestige_tier, is_prestige, updated_at
    `, { count: 'exact' })
    .not('user_id', 'is', null)
    .order('position_score', { ascending: false, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (error) return res.status(500).json({ error: error.message, code: 'LEADERBOARD_QUERY' })

  const userIds = (data || []).map(r => r.user_id).filter((id): id is string => Boolean(id))
  const profileMap: Record<string, { username?: string | null; avatar_url?: string | null; accent_color?: string | null }> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, accent_color')
      .in('id', userIds)
    for (const p of profiles || []) {
      profileMap[p.id] = { username: p.username, avatar_url: p.avatar_url, accent_color: p.accent_color }
    }
  }

  const rows = (data || []).map(r => {
    const profile = (r.user_id && profileMap[r.user_id]) || null
    return {
      user_id: r.user_id,
      spotify_user_id: r.spotify_user_id,
      username: profile?.username ?? null,
      display_name: r.display_name,
      avatar_url: profile?.avatar_url ?? null,
      accent_color: profile?.accent_color ?? '#00dcc8',
      // Preserve null so the client can render "—" for missing data instead
      // of an ambiguous 0.
      position: r.position_score,
      velocity: r.velocity_score,
      acceleration: r.acceleration_score,
      jerk: r.jerk_score,
      snap: r.snap_score,
      prestige_tier: r.prestige_tier ?? 0,
      is_prestige: r.is_prestige ?? false,
      updated_at: r.updated_at,
    }
  })

  return res.status(200).json({
    scores: rows,
    total: count || 0,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil((count || 0) / PAGE_SIZE),
  })
}

// POST ?action=recompute
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

  const { allowed, lastComputed } = await checkRateLimit(supabase, userId)
  if (!allowed) {
    const minutesRemaining = Math.max(0, RATE_LIMIT_MINUTES - Math.floor(
      (Date.now() - (lastComputed?.getTime() || 0)) / 60000
    ))
    return res.status(200).json({
      ok: true,
      rate_limited: true,
      retry_after_minutes: minutesRemaining,
    })
  }

  const body = (req.body ?? {}) as { spotifyAccessToken?: string }

  try {
    const { scores, synced } = await recomputeUser(supabase, userId, body.spotifyAccessToken)
    return res.status(200).json({
      ok: true,
      synced,
      position: scores.position,
      velocity: scores.velocity,
      acceleration: scores.acceleration,
      jerk: scores.jerk,
      snap: scores.snap,
      prestigeTier: scores.prestigeTier,
    })
  } catch (error) {
    console.error('[scores] Recompute error:', error)
    return res.status(500).json({ error: (error as Error).message })
  }
}

// POST ?action=recompute-stale
// Body: { user_ids: string[] }
// For each user with last_computed_at > 5 min old AND with no recent recompute lock,
// run a recompute. No Spotify sync (we don't have the viewer-supplied user tokens).
async function handleRecomputeStale(req: VercelRequest, res: VercelResponse) {
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

  const body = (req.body ?? {}) as { user_ids?: string[] }
  const requestedIds = Array.isArray(body.user_ids) ? body.user_ids.slice(0, 50) : []
  if (requestedIds.length === 0) return res.status(200).json({ ok: true, processed: 0 })

  const cutoff = new Date(Date.now() - RATE_LIMIT_MINUTES * 60_000).toISOString()
  const { data: locks } = await supabase
    .from('recompute_locks')
    .select('user_id, last_computed_at')
    .in('user_id', requestedIds)

  const lockMap = new Map((locks ?? []).map(l => [l.user_id, l.last_computed_at]))
  const toProcess = requestedIds.filter(uid => {
    const last = lockMap.get(uid)
    return !last || last < cutoff
  })

  let processed = 0
  for (const uid of toProcess) {
    try {
      await recomputeUser(supabase, uid)
      processed++
    } catch (err) {
      console.error(`[scores] recompute-stale ${uid} failed:`, err)
    }
  }

  return res.status(200).json({ ok: true, processed, totalRequested: requestedIds.length })
}

// POST ?action=recompute-all
//
// On-demand server-wide recompute. Same work as the daily cron at
// `/api/cron/recompute`: iterate spotify_tokens, refresh expired
// access tokens, ingest recently-played, score, persist events.
//
// Auth: Authorization: Bearer ${CRON_SECRET}. Lets Stone fire from a
// terminal without waiting for the daily cron, and keeps the surface
// off the admin UI (no accidental triggers).
//
// curl example (set CRON_SECRET via Vercel env):
//   curl -X POST https://mheu.lol/api/scores?action=recompute-all \
//        -H "Authorization: Bearer $CRON_SECRET"
async function handleRecomputeAll(req: VercelRequest, res: VercelResponse) {
  const expectedSecret = process.env.CRON_SECRET
  if (!expectedSecret) {
    return res.status(500).json({ error: 'CRON_SECRET not configured' })
  }
  const authHeader = req.headers.authorization
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const t0 = Date.now()
  const supabase = getServiceSupabase()
  let ingested = 0
  let events = 0

  const counts = await forEachLinkedUser(
    supabase,
    async (userId, accessToken) => {
      const sync = await syncRecentlyPlayed(supabase, userId, accessToken)
      ingested += sync.inserted
      if (!sync.ok && sync.status === 403) {
        console.warn(`[scores] recompute-all: ${userId} 403 (likely missing user-read-recently-played scope)`)
      }
      // Skip the duplicate sync inside recomputeUser by not passing a token —
      // we already ingested above and need recomputeUser only for scoring +
      // history + user_scores upsert.
      const { eventsWritten } = await recomputeUser(supabase, userId)
      events += eventsWritten
    },
    (msg, extra) => console.log(`[scores] recompute-all ${msg}`, extra ?? ''),
  )

  return res.status(200).json({
    ok: true,
    elapsedMs: Date.now() - t0,
    plays_ingested: ingested,
    events_written: events,
    ...counts,
  })
}

// POST - legacy upsert (Spotify-JWT-authenticated path used by old client code)
async function handleUpsertScore(req: VercelRequest, res: VercelResponse) {
  let supabase
  try {
    supabase = getSupabase()
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'DB error' })
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
    .upsert({
      spotify_user_id: spotify_id,
      display_name,
      score,
      listening_minutes: listening_minutes || 0,
      top_genre: top_genre || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'spotify_user_id' })

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}

export async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action as string | undefined
  console.log('[scores] request', { method: req.method, action: action ?? '(leaderboard)' })

  try {
    if (req.method === 'GET') {
      if (action === 'user-scores') return await handleUserScores(req, res)
      if (action === 'events') return await handleEvents(req, res)
      return await handleLeaderboard(req, res)
    }

    if (req.method === 'POST') {
      if (action === 'recompute') return await handleRecompute(req, res)
      if (action === 'recompute-stale') return await handleRecomputeStale(req, res)
      if (action === 'recompute-all') return await handleRecomputeAll(req, res)
      return await handleUpsertScore(req, res)
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    // Surface the real error in the response body so future 500s are
    // debuggable without trawling Vercel logs. Stack traces stay in logs.
    const message = err instanceof Error ? err.message : String(err)
    const code = (err as { code?: string })?.code ?? 'INTERNAL'
    console.error('[scores] unhandled error', { code, message, stack: err instanceof Error ? err.stack : undefined })
    if (!res.headersSent) {
      return res.status(500).json({ error: message, code })
    }
  }
}
