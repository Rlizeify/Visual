// Spotify Connector
// Fetches listening data from Supabase tables populated by Spotify OAuth sync.

import { createClient } from '@supabase/supabase-js'
import type { Connector, ConnectorField, TimeScale, FetchResult } from './types.js'
import { makeFieldId, getEffortMultiplier } from './types.js'

const CONNECTOR_ID = 'spotify'

function getServiceSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase config')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// Field definitions
// Field definitions - weights are 0-3 scale (admin can override)
const fields: ConnectorField[] = [
  {
    id: makeFieldId(CONNECTOR_ID, 'listening_minutes'),
    displayName: 'Listening Minutes',
    description: 'Total minutes spent listening to music',
    unit: 'minutes',
    dataType: 'duration',
    defaultWeight: 1.5, // Primary metric
    defaultEffortMultiplier: getEffortMultiplier('passive'),
    sparsityClass: 'passive',
    expectedRange: [0, 480], // 0-8 hours per day
    inactive: false,
  },
  {
    id: makeFieldId(CONNECTOR_ID, 'unique_artists'),
    displayName: 'Unique Artists',
    description: 'Number of distinct artists listened to',
    unit: 'count',
    dataType: 'count',
    defaultWeight: 1.0,
    defaultEffortMultiplier: getEffortMultiplier('passive'),
    sparsityClass: 'passive',
    expectedRange: [0, 100],
    inactive: false,
  },
  {
    id: makeFieldId(CONNECTOR_ID, 'unique_tracks'),
    displayName: 'Unique Tracks',
    description: 'Number of distinct tracks listened to',
    unit: 'count',
    dataType: 'count',
    defaultWeight: 0.8,
    defaultEffortMultiplier: getEffortMultiplier('passive'),
    sparsityClass: 'passive',
    expectedRange: [0, 500],
    inactive: false,
  },
  {
    id: makeFieldId(CONNECTOR_ID, 'unique_playlists'),
    displayName: 'Unique Playlists',
    description: 'Number of distinct playlists played from',
    unit: 'count',
    dataType: 'count',
    defaultWeight: 0.5,
    defaultEffortMultiplier: getEffortMultiplier('semi-active'),
    sparsityClass: 'semi-active',
    expectedRange: [0, 20],
    inactive: false,
  },
  {
    id: makeFieldId(CONNECTOR_ID, 'consistency'),
    displayName: 'Listening Consistency',
    description: 'Percentage of days with listening activity in the period',
    unit: '%',
    dataType: 'ratio',
    defaultWeight: 1.2,
    defaultEffortMultiplier: getEffortMultiplier('passive'),
    sparsityClass: 'passive',
    expectedRange: [0, 100],
    inactive: false,
  },
  {
    id: makeFieldId(CONNECTOR_ID, 'top_genre_concentration'),
    displayName: 'Top Genre Concentration',
    description: 'Percentage of listening time in top genre (lower = more diverse)',
    unit: '%',
    dataType: 'ratio',
    defaultWeight: 0.4,
    defaultEffortMultiplier: getEffortMultiplier('passive'),
    sparsityClass: 'passive',
    expectedRange: [0, 100],
    inactive: false,
  },
  {
    id: makeFieldId(CONNECTOR_ID, 'discovery_rate'),
    displayName: 'Discovery Rate',
    description: 'Percentage of tracks that are new (first listen in 30 days)',
    unit: '%',
    dataType: 'ratio',
    defaultWeight: 0.7,
    defaultEffortMultiplier: getEffortMultiplier('semi-active'),
    sparsityClass: 'semi-active',
    expectedRange: [0, 100],
    inactive: false,
  },
]

// Calculate date range based on time scale
function getDateRange(timeScale: TimeScale): { startDate: string; endDate: string; days: number } {
  const now = new Date()
  const endDate = now.toISOString().split('T')[0]

  let days: number
  switch (timeScale) {
    case 'day':
      days = 1
      break
    case 'week':
      days = 7
      break
    case 'month':
      days = 30
      break
  }

  const start = new Date(now)
  start.setDate(start.getDate() - days + 1)
  const startDate = start.toISOString().split('T')[0]

  return { startDate, endDate, days }
}

// Fetch implementation
async function fetch(userId: string, timeScale: TimeScale): Promise<FetchResult> {
  const supabase = getServiceSupabase()
  const { startDate, endDate, days } = getDateRange(timeScale)

  const result: FetchResult = {}

  // Initialize all fields to null
  for (const field of fields) {
    result[field.id] = null
  }

  try {
    // Fetch listening stats for the period
    const { data: stats, error: statsError } = await supabase
      .from('user_listening_stats')
      .select('date, listening_minutes')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })

    if (statsError) {
      console.error('[spotify] Stats fetch error:', statsError)
      return result
    }

    if (!stats || stats.length === 0) {
      return result
    }

    // Calculate listening_minutes (sum)
    const totalMinutes = stats.reduce((sum, s) => sum + (s.listening_minutes || 0), 0)
    result[makeFieldId(CONNECTOR_ID, 'listening_minutes')] = totalMinutes

    // Calculate consistency (% of days with activity)
    const daysWithActivity = stats.filter(s => s.listening_minutes > 0).length
    const consistency = Math.round((daysWithActivity / days) * 100)
    result[makeFieldId(CONNECTOR_ID, 'consistency')] = consistency

    // Fetch detailed play history for other metrics
    const { data: history, error: historyError } = await supabase
      .from('spotify_play_history')
      .select('track_id, artist_id, playlist_id, genre, played_at')
      .eq('user_id', userId)
      .gte('played_at', `${startDate}T00:00:00Z`)
      .lte('played_at', `${endDate}T23:59:59Z`)

    if (historyError) {
      console.error('[spotify] History fetch error:', historyError)
      // Return partial results
      return result
    }

    if (history && history.length > 0) {
      // Unique counts
      const uniqueArtists = new Set(history.map(h => h.artist_id).filter(Boolean))
      const uniqueTracks = new Set(history.map(h => h.track_id).filter(Boolean))
      const uniquePlaylists = new Set(history.map(h => h.playlist_id).filter(Boolean))

      result[makeFieldId(CONNECTOR_ID, 'unique_artists')] = uniqueArtists.size
      result[makeFieldId(CONNECTOR_ID, 'unique_tracks')] = uniqueTracks.size
      result[makeFieldId(CONNECTOR_ID, 'unique_playlists')] = uniquePlaylists.size

      // Genre concentration
      const genreCounts: Record<string, number> = {}
      let totalWithGenre = 0
      for (const h of history) {
        if (h.genre) {
          genreCounts[h.genre] = (genreCounts[h.genre] || 0) + 1
          totalWithGenre++
        }
      }

      if (totalWithGenre > 0) {
        const topGenreCount = Math.max(...Object.values(genreCounts))
        const concentration = Math.round((topGenreCount / totalWithGenre) * 100)
        result[makeFieldId(CONNECTOR_ID, 'top_genre_concentration')] = concentration
      }

      // Discovery rate - tracks not heard in prior 30 days
      if (timeScale !== 'month') {
        const priorStart = new Date()
        priorStart.setDate(priorStart.getDate() - 30)
        const priorStartStr = priorStart.toISOString()

        const { data: priorHistory } = await supabase
          .from('spotify_play_history')
          .select('track_id')
          .eq('user_id', userId)
          .gte('played_at', priorStartStr)
          .lt('played_at', `${startDate}T00:00:00Z`)

        const priorTracks = new Set((priorHistory || []).map(h => h.track_id))
        const currentTracks = Array.from(uniqueTracks)
        const newTracks = currentTracks.filter(t => !priorTracks.has(t))
        const discoveryRate = currentTracks.length > 0
          ? Math.round((newTracks.length / currentTracks.length) * 100)
          : 0

        result[makeFieldId(CONNECTOR_ID, 'discovery_rate')] = discoveryRate
      } else {
        // For month timeScale, discovery rate doesn't make sense
        result[makeFieldId(CONNECTOR_ID, 'discovery_rate')] = null
      }
    }

    return result
  } catch (error) {
    console.error('[spotify] Unexpected error:', error)
    return result
  }
}

const connector: Connector = {
  id: CONNECTOR_ID,
  displayName: 'Spotify',
  isActive: true,
  fields,
  fetch,
}

export default connector
