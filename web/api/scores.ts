// Scores API (merged leaderboard + user-scores + score-events)
// Routes:
//   GET - list scores for leaderboard (public)
//   POST - upsert user score (requires auth)
//   GET ?action=user-scores - get user's position/velocity/acceleration/jerk/snap
//   GET ?action=events - get social feed events

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getSupabase } from './_db.js'
import { getSpotifyId } from './_auth.js'

const PAGE_SIZE = 50

function getServiceSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase config')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

interface DailyStats {
  date: string
  listening_minutes: number
}

interface UserScores {
  position: number | null
  velocity: number | null
  acceleration: number | null
  jerk: number | null
  snap: number | null
  last_updated: string | null
}

function calculateScores(stats: DailyStats[]): UserScores {
  if (stats.length === 0) {
    return { position: null, velocity: null, acceleration: null, jerk: null, snap: null, last_updated: null }
  }

  const sorted = [...stats].sort((a, b) => b.date.localeCompare(a.date))
  const today = new Date().toISOString().split('T')[0]
  const todayStats = sorted.find(s => s.date === today)

  // Position (total this week)
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = weekAgo.toISOString().split('T')[0]
  const thisWeek = sorted.filter(s => s.date >= weekAgoStr)
  const position = thisWeek.reduce((sum, s) => sum + s.listening_minutes, 0)

  // Velocity (today)
  const velocity = todayStats?.listening_minutes ?? null

  // Get last 5 days for derivatives
  const lastDays: (number | null)[] = []
  for (let i = 0; i < 5; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const dayStats = sorted.find(s => s.date === dateStr)
    lastDays.push(dayStats?.listening_minutes ?? null)
  }

  // Acceleration (today - yesterday)
  let acceleration: number | null = null
  if (lastDays[0] !== null && lastDays[1] !== null) {
    acceleration = lastDays[0] - lastDays[1]
  }

  // Jerk (change in acceleration)
  let jerk: number | null = null
  if (lastDays[0] !== null && lastDays[1] !== null && lastDays[2] !== null) {
    const prevAcceleration = lastDays[1] - lastDays[2]
    if (acceleration !== null) {
      jerk = acceleration - prevAcceleration
    }
  }

  // Snap (change in jerk)
  let snap: number | null = null
  if (lastDays[0] !== null && lastDays[1] !== null && lastDays[2] !== null && lastDays[3] !== null) {
    const accel0 = lastDays[0] - lastDays[1]
    const accel1 = lastDays[1] - lastDays[2]
    const accel2 = lastDays[2] - lastDays[3]
    const jerk0 = accel0 - accel1
    const jerk1 = accel1 - accel2
    snap = jerk0 - jerk1
  }

  return { position, velocity, acceleration, jerk, snap, last_updated: sorted[0]?.date ?? null }
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

// Write score_events for any changed scores, update user_scores with new values
async function writeScoreEventsIfChanged(
  supabase: ReturnType<typeof getServiceSupabase>,
  userId: string,
  newScores: UserScores,
  todayMinutes: number | null
): Promise<void> {
  // First, find the user_scores row - try by user_id, then by looking up spotify_user_id via users table
  let userScoresRow: (StoredScores & { spotify_user_id?: string }) | null = null

  // Try direct lookup by user_id
  const { data: byUserId } = await supabase
    .from('user_scores')
    .select('spotify_user_id, position_score, velocity_score, acceleration_score, jerk_score, snap_score')
    .eq('user_id', userId)
    .maybeSingle()

  if (byUserId) {
    userScoresRow = byUserId
  } else {
    // Fall back: get email from auth, find spotify_id from users table, then find user_scores
    const { data: authUser } = await supabase.auth.admin.getUserById(userId)
    if (authUser?.user?.email) {
      const { data: spotifyUser } = await supabase
        .from('users')
        .select('spotify_id')
        .eq('email', authUser.user.email)
        .maybeSingle()

      if (spotifyUser?.spotify_id) {
        const { data: bySpotifyId } = await supabase
          .from('user_scores')
          .select('spotify_user_id, position_score, velocity_score, acceleration_score, jerk_score, snap_score')
          .eq('spotify_user_id', spotifyUser.spotify_id)
          .maybeSingle()

        if (bySpotifyId) {
          userScoresRow = bySpotifyId
        }
      }
    }
  }

  // If no user_scores row exists, skip event writing (user not fully set up yet)
  if (!userScoresRow) {
    return
  }

  const old: StoredScores = {
    position_score: userScoresRow.position_score,
    velocity_score: userScoresRow.velocity_score,
    acceleration_score: userScoresRow.acceleration_score,
    jerk_score: userScoresRow.jerk_score,
    snap_score: userScoresRow.snap_score,
  }

  // Check if this is the first time we're storing derivative scores
  const isInitial = old.position_score === null && old.velocity_score === null

  const events: Array<{ user_id: string; score_type: ScoreType; delta: number; source_action: string }> = []

  // Compare each score and create events for changes
  for (const scoreType of SCORE_TYPES) {
    const newVal = newScores[scoreType]
    const oldVal = old[`${scoreType}_score` as keyof StoredScores]

    // Skip if new value is null (insufficient data)
    if (newVal === null) continue

    // Calculate delta
    const delta = isInitial ? newVal : (oldVal !== null ? newVal - oldVal : newVal)

    // Only write if there's an actual change (or initial)
    if (delta === 0 && !isInitial) continue

    // Determine source_action based on score type
    let sourceAction: string
    if (isInitial) {
      sourceAction = 'initial_calculation'
    } else if (scoreType === 'position') {
      sourceAction = `spotify_weekly_${newVal}m`
    } else if (scoreType === 'velocity') {
      sourceAction = `spotify_today_${todayMinutes ?? 0}m`
    } else {
      sourceAction = `derivative_${scoreType}`
    }

    events.push({
      user_id: userId,
      score_type: scoreType,
      delta,
      source_action: sourceAction,
    })
  }

  // Insert events if any
  if (events.length > 0) {
    await supabase.from('score_events').insert(events)
  }

  // Update user_scores with new values
  const updateData: Record<string, unknown> = {
    position_score: newScores.position,
    velocity_score: newScores.velocity,
    acceleration_score: newScores.acceleration,
    jerk_score: newScores.jerk,
    snap_score: newScores.snap,
    updated_at: new Date().toISOString(),
  }

  await supabase
    .from('user_scores')
    .update(updateData)
    .eq('spotify_user_id', userScoresRow.spotify_user_id)
}

// GET ?action=user-scores - user's derivative scores
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

  const { data: stats, error: statsError } = await supabase
    .from('user_listening_stats')
    .select('date, listening_minutes')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(30)

  if (statsError) {
    return res.status(500).json({ error: statsError.message })
  }

  const scores = calculateScores(stats || [])

  // Write score_events if scores changed (runs in background, doesn't block response)
  const todayMinutes = scores.velocity
  writeScoreEventsIfChanged(supabase, userId, scores, todayMinutes).catch(err => {
    console.error('[scores] Failed to write score events:', err)
  })

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

  return res.status(200).json({ scores, tooltips, visibility: visibilityMap })
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
    return handleUpsertScore(req, res)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
