// Score events API - returns the social feed of score changes

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

function getServiceSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase config')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabase = getServiceSupabase()

  // Get the current user (optional - for determining visibility)
  let currentUserId: string | null = null
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const { data: userData } = await supabase.auth.getUser(token)
    currentUserId = userData?.user?.id ?? null
  }

  // Fetch recent score events with profile info
  const { data: events, error } = await supabase
    .from('score_events')
    .select(`
      id,
      user_id,
      score_type,
      delta,
      source_action,
      visibility_override,
      created_at,
      profiles(username, display_name)
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  // Get visibility settings for users to determine what to reveal
  const userIds = [...new Set((events || []).map(e => e.user_id))]
  const { data: visibilityData } = await supabase
    .from('user_score_visibility')
    .select('user_id, score_type, reveal_action')
    .in('user_id', userIds)

  // Build visibility lookup
  const visibilityMap: Record<string, Record<string, boolean>> = {}
  for (const v of visibilityData || []) {
    if (!visibilityMap[v.user_id]) visibilityMap[v.user_id] = {}
    visibilityMap[v.user_id][v.score_type] = v.reveal_action
  }

  // Transform events for the feed
  // - source_action is ONLY shown if the viewer is the event owner AND visibility is enabled
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
