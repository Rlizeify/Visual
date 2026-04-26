// Spotify Web API with Audio Analysis + minimal polling

const CLIENT_ID = '1da72125c08248d99fc0677d415f4e36'
const REDIRECT_URI = window.location.hostname === 'localhost'
  ? 'http://localhost:5173/callback'
  : 'https://project-iwmob.vercel.app/callback'
const SCOPES = [
  'user-read-email',
  'user-read-private',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join(' ')

// PKCE helpers
function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const values = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(values).map(x => possible[x % possible.length]).join('')
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const data = encoder.encode(plain)
  return crypto.subtle.digest('SHA-256', data)
}

function base64urlencode(a: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(a)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// OAuth PKCE flow
export async function buildAuthUrl(): Promise<string> {
  const codeVerifier = generateRandomString(64)
  const hashed = await sha256(codeVerifier)
  const codeChallenge = base64urlencode(hashed)

  sessionStorage.setItem('code_verifier', codeVerifier)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  })

  return `https://accounts.spotify.com/authorize?${params.toString()}`
}

export async function initiateSpotifyLogin(): Promise<void> {
  window.location.href = await buildAuthUrl()
}

export async function handleCallback(): Promise<string | null> {
  const urlParams = new URLSearchParams(window.location.search)
  const code = urlParams.get('code')
  const codeVerifier = sessionStorage.getItem('code_verifier')

  if (!code || !codeVerifier) return null

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
    }),
  })

  const data = await response.json()
  if (data.access_token) {
    localStorage.setItem('spotify_access_token', data.access_token)
    localStorage.setItem('spotify_refresh_token', data.refresh_token)
    localStorage.setItem('spotify_token_expiry', String(Date.now() + data.expires_in * 1000))
    sessionStorage.removeItem('code_verifier')
    return data.access_token
  }
  return null
}

export function getAccessToken(): string | null {
  return localStorage.getItem('spotify_access_token')
}

export function isAuthenticated(): boolean {
  const token = getAccessToken()
  const expiry = localStorage.getItem('spotify_token_expiry')
  if (!token || !expiry) return false
  return Date.now() < parseInt(expiry)
}

export async function refreshToken(): Promise<string | null> {
  const storedRefresh = localStorage.getItem('spotify_refresh_token')
  if (!storedRefresh) return null

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: storedRefresh,
    }),
  })

  const data = await response.json()
  if (data.access_token) {
    localStorage.setItem('spotify_access_token', data.access_token)
    localStorage.setItem('spotify_token_expiry', String(Date.now() + data.expires_in * 1000))
    if (data.refresh_token) {
      localStorage.setItem('spotify_refresh_token', data.refresh_token)
    }
    return data.access_token
  }
  return null
}

// User profile
export async function fetchUserProfile(): Promise<{ display_name: string; email: string } | null> {
  const token = getAccessToken()
  if (!token) return null

  const response = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (response.ok) return response.json()
  return null
}

// Audio Analysis types
export interface AudioAnalysisBeat {
  start: number      // seconds
  duration: number   // seconds
  confidence: number // 0-1
}

export interface AudioAnalysisSegment {
  start: number
  duration: number
  confidence: number
  loudness_start: number    // dB
  loudness_max: number      // dB
  loudness_max_time: number // seconds into segment
  loudness_end: number      // dB
  pitches: number[]         // 12 values, 0-1
  timbre: number[]          // 12 values
}

export interface AudioAnalysisSection {
  start: number
  duration: number
  confidence: number
  loudness: number  // dB
  tempo: number     // BPM
  key: number       // 0-11
  mode: number      // 0=minor, 1=major
}

export interface AudioAnalysis {
  beats: AudioAnalysisBeat[]
  segments: AudioAnalysisSegment[]
  sections: AudioAnalysisSection[]
  track: {
    tempo: number
    duration: number
  }
}

// Music data state
export interface MusicData {
  isPlaying: boolean
  trackId: string | null
  trackName: string
  artistName: string
  albumArt: string
  progress: number       // progress_ms from last poll
  duration: number       // ms
  tempo: number          // BPM (updated from audio analysis)
  shuffleState: boolean
  // Timing for clock-drift correction
  pollTimestamp: number  // performance.now() when last polled (kept for reference)
  serverTimestamp: number // Unix epoch ms from Spotify response (data.timestamp)
}

const defaultMusicData: MusicData = {
  isPlaying: false,
  trackId: null,
  trackName: '',
  artistName: '',
  albumArt: '',
  progress: 0,
  duration: 0,
  tempo: 120,
  shuffleState: false,
  pollTimestamp: 0,
  serverTimestamp: 0,
}

let currentMusicData: MusicData = { ...defaultMusicData }
let currentAnalysis: AudioAnalysis | null = null
let bpmFallbackActive = false
let pollInterval: ReturnType<typeof setInterval> | null = null
let rafId: number | null = null
let currentBeatIndex = 0
let beatPulse = 0 // 0-1, decays over time

// Frequency array for Butterchurn (2048 values)
const frequencyData = new Uint8Array(2048)


export function getMusicData(): MusicData {
  return currentMusicData
}

export function getAnalysis(): AudioAnalysis | null {
  return currentAnalysis
}

export function getFrequencyData(): Uint8Array {
  return frequencyData
}

export function isBpmFallback(): boolean {
  return bpmFallbackActive
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

// Fetch audio analysis when track changes. Stores result in module-level ref (not state).
async function fetchAudioAnalysis(trackId: string): Promise<void> {
  const token = getAccessToken()
  if (!token) return

  // Reset fallback flag — give new track a clean attempt
  bpmFallbackActive = false
  currentAnalysis = null

  try {
    const response = await fetch(`https://api.spotify.com/v1/audio-analysis/${trackId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (response.status === 403 || response.status === 404) {
      console.warn(`[AudioAnalysis] ${response.status} — BPM fallback active (tempo: ${currentMusicData.tempo})`)
      bpmFallbackActive = true
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
      currentBeatIndex = 0
      // Sync tempo to MusicData so BPM fallback has it if analysis later becomes unavailable
      currentMusicData = { ...currentMusicData, tempo: currentAnalysis.track.tempo }
      console.log('[AudioAnalysis] Loaded:', {
        beats: currentAnalysis.beats.length,
        segments: currentAnalysis.segments.length,
        sections: currentAnalysis.sections.length,
        tempo: currentAnalysis.track.tempo,
      })

      // Log first segment details for debugging
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

// Find current segment at given time (seconds)
function findCurrentSegment(timeSec: number): AudioAnalysisSegment | null {
  if (!currentAnalysis) return null
  for (let i = currentAnalysis.segments.length - 1; i >= 0; i--) {
    const seg = currentAnalysis.segments[i]
    if (timeSec >= seg.start) return seg
  }
  return currentAnalysis.segments[0] || null
}

// Find current beat and update beat pulse
function updateBeatPulse(timeSec: number): void {
  if (!currentAnalysis || currentAnalysis.beats.length === 0) {
    beatPulse *= 0.95 // decay
    return
  }

  const beats = currentAnalysis.beats

  // Find current beat index
  while (currentBeatIndex < beats.length - 1 && timeSec >= beats[currentBeatIndex + 1].start) {
    currentBeatIndex++
    beatPulse = 1.0 // Sharp attack on beat
  }

  // Handle case where we've seeked backwards
  if (currentBeatIndex > 0 && timeSec < beats[currentBeatIndex].start) {
    currentBeatIndex = 0
    for (let i = 0; i < beats.length; i++) {
      if (beats[i].start <= timeSec) currentBeatIndex = i
      else break
    }
  }

  const currentBeat = beats[currentBeatIndex]
  if (!currentBeat) return

  // Calculate time since beat start
  const timeSinceBeat = timeSec - currentBeat.start

  // Exponential decay from beat
  if (timeSinceBeat >= 0 && timeSinceBeat < currentBeat.duration) {
    // Only decay, don't set (attack happens on beat transition)
    beatPulse *= 0.92
  } else {
    beatPulse *= 0.95
  }

  beatPulse = Math.max(0, Math.min(1, beatPulse))
}

// Generate synthetic frequency data from audio analysis
function generateFrequencyData(): void {
  const timeSec = getInterpolatedProgress() / 1000
  const segment = findCurrentSegment(timeSec)
  updateBeatPulse(timeSec)

  if (!segment || !currentMusicData.isPlaying) {
    // Decay to silence when not playing
    for (let i = 0; i < 2048; i++) {
      frequencyData[i] = Math.floor(frequencyData[i] * 0.9)
    }
    return
  }

  // Normalize loudness (typically -60 to 0 dB) to 0-1
  const loudnessNorm = Math.max(0, Math.min(1, (segment.loudness_max + 60) / 60))

  // Bass (0-50): loudness * beat pulse
  const bassBase = loudnessNorm * 255
  for (let i = 0; i < 51; i++) {
    const bassPulse = bassBase * (0.6 + beatPulse * 0.4)
    frequencyData[i] = Math.floor(Math.min(255, bassPulse * (1 - i / 100)))
  }

  // Mids (51-512): pitches[0..5] average
  const midPitches = segment.pitches.slice(0, 6)
  const midAvg = midPitches.reduce((a, b) => a + b, 0) / midPitches.length
  for (let i = 51; i < 513; i++) {
    const variation = Math.sin(i * 0.05 + timeSec * 3) * 0.2 + 0.8
    frequencyData[i] = Math.floor(midAvg * 200 * variation * (0.7 + beatPulse * 0.3))
  }

  // Highs (513-2047): pitches[6..11] average
  const highPitches = segment.pitches.slice(6, 12)
  const highAvg = highPitches.reduce((a, b) => a + b, 0) / highPitches.length
  for (let i = 513; i < 2048; i++) {
    const variation = Math.sin(i * 0.02 + timeSec * 5) * 0.3 + 0.7
    const decay = 1 - (i - 513) / 2000
    frequencyData[i] = Math.floor(highAvg * 180 * variation * decay * (0.8 + beatPulse * 0.2))
  }

}

// Main render loop (requestAnimationFrame)
function renderLoop(): void {
  generateFrequencyData()
  rafId = requestAnimationFrame(renderLoop)
}

// Poll playback state every 5000ms
async function pollPlaybackState(): Promise<void> {
  const token = getAccessToken()
  if (!token) {
    console.log('[Poll] No token')
    return
  }

  try {
    const response = await fetch('https://api.spotify.com/v1/me/player', {
      headers: { Authorization: `Bearer ${token}` },
    })

    console.log('[Poll] HTTP', response.status)

    if (response.status === 204) {
      currentMusicData = { ...currentMusicData, isPlaying: false }
      return
    }

    if (response.ok) {
      const data = await response.json()
      const trackId = data.item?.id ?? null
      const prevTrackId = currentMusicData.trackId

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

      // Fetch audio analysis when track changes
      if (trackId && trackId !== prevTrackId) {
        fetchAudioAnalysis(trackId)
      }
    }
  } catch (err) {
    console.error('[Poll] Network error', err)
  }
}

export function startPolling(): void {
  // Initial poll
  pollPlaybackState()

  // Poll every 5000ms
  if (pollInterval) clearInterval(pollInterval)
  pollInterval = setInterval(pollPlaybackState, 5000)

  // Start render loop
  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(renderLoop)

  console.log('[Polling] Started (5000ms interval)')
}

export function stopPolling(): void {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  console.log('[Polling] Stopped')
}

// Playback controls via Web API
export async function play(): Promise<void> {
  const token = getAccessToken()
  if (!token) return
  await fetch('https://api.spotify.com/v1/me/player/play', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  })
  // Immediate re-poll to update state
  setTimeout(pollPlaybackState, 200)
}

export async function pause(): Promise<void> {
  const token = getAccessToken()
  if (!token) return
  await fetch('https://api.spotify.com/v1/me/player/pause', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  })
  setTimeout(pollPlaybackState, 200)
}

export async function nextTrack(): Promise<void> {
  const token = getAccessToken()
  if (!token) return
  await fetch('https://api.spotify.com/v1/me/player/next', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  setTimeout(pollPlaybackState, 500)
}

export async function previousTrack(): Promise<void> {
  const token = getAccessToken()
  if (!token) return
  await fetch('https://api.spotify.com/v1/me/player/previous', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  setTimeout(pollPlaybackState, 500)
}

export async function toggleShuffle(state: boolean): Promise<void> {
  const token = getAccessToken()
  if (!token) return
  await fetch(`https://api.spotify.com/v1/me/player/shuffle?state=${state}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  })
  setTimeout(pollPlaybackState, 200)
}
