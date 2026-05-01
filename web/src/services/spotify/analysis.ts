import { getAccessToken, refreshToken } from './tokens'
import { getMusicData, setMusicDataTempo } from './polling'
import type { AudioAnalysis } from './types'

let currentAnalysis: AudioAnalysis | null = null
let bpmFallbackActive = false

export function getAnalysis(): AudioAnalysis | null {
  return currentAnalysis
}

export function isBpmFallback(): boolean {
  return bpmFallbackActive
}

// Fetch audio analysis when track changes. Stores result in module-level ref (not state).
export async function fetchAudioAnalysis(trackId: string): Promise<void> {
  // Ensure token is fresh — refresh up to 30s before expiry
  let token = getAccessToken()
  if (!token) return

  const expiry = localStorage.getItem('mheu_token_expiry')
  if (expiry && Date.now() >= parseInt(expiry) - 30000) {
    console.log('[AudioAnalysis] Token near/past expiry, refreshing...')
    token = await refreshToken()
    if (!token) {
      console.warn('[AudioAnalysis] Token refresh failed — aborting analysis fetch')
      return
    }
  }

  // Reset fallback flag — give new track a clean attempt
  bpmFallbackActive = false
  currentAnalysis = null

  const analysisUrl = `https://api.spotify.com/v1/audio-analysis/${trackId}`
  const requestHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  }
  console.log('[AudioAnalysis] Requesting:', analysisUrl, {
    Authorization: `Bearer ${token.slice(0, 12)}…`,
    Accept: 'application/json',
  })

  try {
    const response = await fetch(analysisUrl, { headers: requestHeaders })
    console.log('[AudioAnalysis] audio-analysis status:', response.status)

    if (response.status === 403 || response.status === 404) {
      console.warn(`[AudioAnalysis] audio-analysis ${response.status} — trying audio-features fallback`)

      const featuresUrl = `https://api.spotify.com/v1/audio-features/${trackId}`
      console.log('[AudioAnalysis] Requesting features:', featuresUrl)
      try {
        const featuresResponse = await fetch(featuresUrl, { headers: requestHeaders })
        console.log('[AudioAnalysis] audio-features status:', featuresResponse.status)
        if (featuresResponse.ok) {
          const features = await featuresResponse.json()
          const tempo = typeof features.tempo === 'number' && features.tempo > 0
            ? features.tempo
            : getMusicData().tempo
          setMusicDataTempo(tempo)
          bpmFallbackActive = true
          console.warn(`[AudioAnalysis] Using BPM fallback: ${Math.round(tempo)}bpm (source: audio-features)`)
          return
        }
      } catch (featErr) {
        console.error('[AudioAnalysis] audio-features fetch error:', featErr)
      }

      bpmFallbackActive = true
      console.warn(`[AudioAnalysis] Using BPM fallback: ${Math.round(getMusicData().tempo)}bpm (source: cached/default)`)
      return
    }

    if (response.ok) {
      const data = await response.json()
      currentAnalysis = {
        beats: data.beats || [],
        segments: data.segments || [],
        sections: data.sections || [],
        track: {
          tempo: data.track?.tempo ?? 120,
          duration: data.track?.duration ?? 0,
        },
      }
      // Sync tempo so BPM fallback has it if analysis later becomes unavailable
      setMusicDataTempo(currentAnalysis.track.tempo)
      console.log('[AudioAnalysis] Loaded:', {
        beats: currentAnalysis.beats.length,
        segments: currentAnalysis.segments.length,
        sections: currentAnalysis.sections.length,
        tempo: currentAnalysis.track.tempo,
      })

      if (currentAnalysis.segments.length > 0) {
        const firstSeg = currentAnalysis.segments[0]
        console.log('[AudioAnalysis] First segment:', {
          loudness_max: firstSeg.loudness_max,
          pitches: firstSeg.pitches,
          timbre: firstSeg.timbre,
        })
      }
    }
  } catch (err) {
    console.error('[AudioAnalysis] Failed to fetch:', err)
  }
}
