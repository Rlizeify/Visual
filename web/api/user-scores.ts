// User scores API - calculates position/velocity/acceleration/jerk/snap from Spotify data
// Formulas:
//   position = total listening minutes this week
//   velocity = listening minutes today
//   acceleration = today minus yesterday
//   jerk = change in acceleration vs day before
//   snap = change in jerk vs day before

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

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
  position: number | null   // total minutes this week
  velocity: number | null   // minutes today
  acceleration: number | null // today - yesterday
  jerk: number | null       // change in acceleration
  snap: number | null       // change in jerk
  last_updated: string | null
}

function calculateScores(stats: DailyStats[]): UserScores {
  if (stats.length === 0) {
    return { position: null, velocity: null, acceleration: null, jerk: null, snap: null, last_updated: null }
  }

  // Sort by date descending (newest first)
  const sorted = [...stats].sort((a, b) => b.date.localeCompare(a.date))

  // Get today's date string
  const today = new Date().toISOString().split('T')[0]
  const todayStats = sorted.find(s => s.date === today)

  // Calculate position (total this week)
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = weekAgo.toISOString().split('T')[0]
  const thisWeek = sorted.filter(s => s.date >= weekAgoStr)
  const position = thisWeek.reduce((sum, s) => sum + s.listening_minutes, 0)

  // Calculate velocity (today)
  const velocity = todayStats?.listening_minutes ?? null

  // Get last 5 days for derivative calculations
  const lastDays: (number | null)[] = []
  for (let i = 0; i < 5; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const dayStats = sorted.find(s => s.date === dateStr)
    lastDays.push(dayStats?.listening_minutes ?? null)
  }

  // Calculate acceleration (today - yesterday)
  let acceleration: number | null = null
  if (lastDays[0] !== null && lastDays[1] !== null) {
    acceleration = lastDays[0] - lastDays[1]
  }

  // Calculate jerk (change in acceleration)
  let jerk: number | null = null
  if (lastDays[0] !== null && lastDays[1] !== null && lastDays[2] !== null) {
    const prevAcceleration = lastDays[1] - lastDays[2]
    if (acceleration !== null) {
      jerk = acceleration - prevAcceleration
    }
  }

  // Calculate snap (change in jerk)
  let snap: number | null = null
  if (lastDays[0] !== null && lastDays[1] !== null && lastDays[2] !== null && lastDays[3] !== null) {
    const accel0 = lastDays[0] - lastDays[1]
    const accel1 = lastDays[1] - lastDays[2]
    const accel2 = lastDays[2] - lastDays[3]
    const jerk0 = accel0 - accel1
    const jerk1 = accel1 - accel2
    snap = jerk0 - jerk1
  }

  return {
    position,
    velocity,
    acceleration,
    jerk,
    snap,
    last_updated: sorted[0]?.date ?? null,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Get user from auth header
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization' })
  }

  const token = authHeader.slice(7)
  const supabase = getServiceSupabase()

  // Validate token and get user
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  const userId = userData.user.id

  // Get listening stats from database
  const { data: stats, error: statsError } = await supabase
    .from('user_listening_stats')
    .select('date, listening_minutes')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(30) // Last 30 days

  if (statsError) {
    return res.status(500).json({ error: statsError.message })
  }

  const scores = calculateScores(stats || [])

  // Get tooltips for this user
  const { data: defaultTooltips } = await supabase
    .from('tooltip_defaults')
    .select('score_type, text')

  const { data: userOverrides } = await supabase
    .from('tooltip_overrides')
    .select('score_type, text')
    .eq('user_id', userId)

  // Get visibility settings
  const { data: visibility } = await supabase
    .from('user_score_visibility')
    .select('score_type, reveal_action')
    .eq('user_id', userId)

  // Merge tooltips (user overrides take precedence)
  const tooltips: Record<string, string> = {}
  for (const t of defaultTooltips || []) {
    tooltips[t.score_type] = t.text
  }
  for (const t of userOverrides || []) {
    tooltips[t.score_type] = t.text
  }

  // Build visibility map
  const visibilityMap: Record<string, boolean> = {}
  for (const v of visibility || []) {
    visibilityMap[v.score_type] = v.reveal_action
  }

  return res.status(200).json({
    scores,
    tooltips,
    visibility: visibilityMap,
  })
}
