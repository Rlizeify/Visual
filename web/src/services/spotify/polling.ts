import { getValidAccessToken, refreshToken } from './tokens'
import type { MusicData } from './types'

const defaultMusicData: MusicData = {
  isPlaying: false,
  trackId: null,
  trackName: '',
  artistName: '',
  albumArt: '',
  progress: 0,
  duration: 0,
  shuffleState: false,
  pollTimestamp: 0,
  serverTimestamp: 0,
}

let currentMusicData: MusicData = { ...defaultMusicData }
let pollInterval: ReturnType<typeof setInterval> | null = null
let visibilityHandler: (() => void) | null = null

export function getMusicData(): MusicData {
  return currentMusicData
}

// Get interpolated progress (ms) using clock-drift correction:
// localPosition = progress_ms + (Date.now() - serverTimestamp)
export function getInterpolatedProgress(): number {
  if (!currentMusicData.isPlaying) return currentMusicData.progress
  const elapsed = currentMusicData.serverTimestamp > 0
    ? Date.now() - currentMusicData.serverTimestamp
    : performance.now() - currentMusicData.pollTimestamp
  return Math.min(currentMusicData.progress + elapsed, currentMusicData.duration)
}

function fetchPlayer(token: string): Promise<Response> {
  return fetch('https://api.spotify.com/v1/me/player', {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function pollPlaybackState(): Promise<void> {
  // Proactive refresh: getValidAccessToken refreshes when the token is
  // within 60s of expiry. Returns null on terminal refresh failure —
  // notifyRefreshInvalid will already have fired so the banner mounts;
  // we stop the poll loop so we don't churn 5s/cycle against a dead link.
  const token = await getValidAccessToken()
  if (!token) {
    stopPolling()
    return
  }

  try {
    let response = await fetchPlayer(token)

    // 401 after a "valid" token means it went stale between the check
    // and the fetch (clock skew, server-side revocation). One refresh
    // + retry, then give up.
    if (response.status === 401) {
      const fresh = await refreshToken()
      if (!fresh) { stopPolling(); return }
      response = await fetchPlayer(fresh)
      if (response.status === 401) { stopPolling(); return }
    }

    if (response.status === 204) {
      currentMusicData = { ...currentMusicData, isPlaying: false }
      return
    }

    if (response.ok) {
      const data = await response.json()
      const trackId = data.item?.id ?? null

      currentMusicData = {
        ...currentMusicData,
        isPlaying: data.is_playing ?? false,
        trackId,
        trackName: data.item?.name ?? '',
        artistName: data.item?.artists?.[0]?.name ?? '',
        albumArt: data.item?.album?.images?.[0]?.url ?? '',
        progress: data.progress_ms ?? 0,
        duration: data.item?.duration_ms ?? 0,
        shuffleState: data.shuffle_state ?? false,
        pollTimestamp: performance.now(),
        // Clock-drift correction: serverTimestamp is epoch ms from Spotify
        serverTimestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
      }
    }
  } catch (err) {
    console.error('[Poll] Network error', err)
  }
}

function startInterval(): void {
  if (pollInterval) clearInterval(pollInterval)
  pollInterval = setInterval(pollPlaybackState, 5000)
}

export function startPolling(): void {
  pollPlaybackState()
  startInterval()

  // Pause the 5s loop while the tab is hidden — no audible playback
  // on the page means the user is browsing elsewhere; the visualizer
  // RAF and Spotify quota don't need to keep churning. We refresh
  // immediately on visibility return so the UI catches up with whatever
  // played while we were away.
  if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler)
  visibilityHandler = () => {
    if (document.hidden) {
      if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
    } else {
      pollPlaybackState()
      startInterval()
    }
  }
  document.addEventListener('visibilitychange', visibilityHandler)
}

export function stopPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler)
    visibilityHandler = null
  }
}
