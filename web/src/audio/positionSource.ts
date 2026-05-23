// Thin wrapper over the spotify polling singleton that exposes only the
// fields the audio-source orchestrator needs: trackId, current position in
// seconds, and total duration in seconds. Decouples the audio module from
// the Spotify service surface.

import { getMusicData, getInterpolatedProgress } from '../services/spotify/polling'

export interface PositionSnapshot {
  trackId: string | null
  position: number  // seconds
  duration: number  // seconds
}

export function getPositionSnapshot(): PositionSnapshot {
  const md = getMusicData()
  return {
    trackId: md.trackId,
    position: getInterpolatedProgress() / 1000,
    duration: md.duration / 1000,
  }
}
