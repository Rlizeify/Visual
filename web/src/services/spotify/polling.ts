import { getAccessToken } from './tokens'
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

export async function pollPlaybackState(): Promise<void> {
  const token = getAccessToken()
  if (!token) return

  try {
    const response = await fetch('https://api.spotify.com/v1/me/player', {
      headers: { Authorization: `Bearer ${token}` },
    })

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

export function startPolling(): void {
  pollPlaybackState()

  if (pollInterval) clearInterval(pollInterval)
  pollInterval = setInterval(pollPlaybackState, 5000)
}

export function stopPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}
