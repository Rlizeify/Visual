/* SpotifyPlayer.ts — Spotify Web Playback SDK integration for Cockpit.
 *
 * Loads the SDK, creates a player instance, and routes audio through
 * a MediaStream → AudioContext → AnalyserNode chain so the visualizer
 * reacts to Spotify playback. */

declare global {
  interface Window {
    Spotify: any
    onSpotifyWebPlaybackSDKReady: () => void
  }
}

export interface SpotifyTrack {
  uri: string
  name: string
  artist: string
  album: string
  albumArt: string
  duration: number
}

export interface SpotifyPlaylist {
  id: string
  name: string
  imageUrl: string
  trackCount: number
}

type SpotifyStateListener = (state: SpotifyPlayerState) => void

export interface SpotifyPlayerState {
  isPlaying: boolean
  isConnected: boolean
  isReady: boolean
  currentTrack: SpotifyTrack | null
  position: number
  duration: number
}

class SpotifyPlayerService {
  private player: any = null
  private deviceId: string | null = null
  private analyser: AnalyserNode | null = null
  private audioCtx: AudioContext | null = null
  private sourceNode: MediaElementAudioSourceNode | null = null
  private sdkLoaded = false
  private sdkLoadPromise: Promise<void> | null = null
  private listeners: Set<SpotifyStateListener> = new Set()

  private state: SpotifyPlayerState = {
    isPlaying: false,
    isConnected: false,
    isReady: false,
    currentTrack: null,
    position: 0,
    duration: 0,
  }

  // ─── SDK loading ─────────────────────────────────────────────────────────

  loadSDK(): Promise<void> {
    if (this.sdkLoaded) return Promise.resolve()
    if (this.sdkLoadPromise) return this.sdkLoadPromise

    this.sdkLoadPromise = new Promise<void>((resolve) => {
      window.onSpotifyWebPlaybackSDKReady = () => {
        this.sdkLoaded = true
        resolve()
      }

      const script = document.createElement('script')
      script.src = 'https://sdk.scdn.co/spotify-player.js'
      script.async = true
      document.head.appendChild(script)
    })

    return this.sdkLoadPromise
  }

  // ─── Player initialization ───────────────────────────────────────────────

  async init(accessToken: string): Promise<boolean> {
    await this.loadSDK()

    if (this.player) {
      this.player.disconnect()
    }

    const api = (window as any).api

    this.player = new window.Spotify.Player({
      name: 'MHEU Visual',
      getOAuthToken: async (cb: (token: string) => void) => {
        // Always get a fresh token from main process
        const token = await api?.spotifyGetAccessToken()
        if (token) cb(token)
        else cb(accessToken) // fallback to initial token
      },
      volume: 0.5,
    })

    return new Promise<boolean>((resolve) => {
      this.player.addListener('ready', ({ device_id }: { device_id: string }) => {
        console.log('[SPOTIFY] Player ready, device:', device_id)
        this.deviceId = device_id
        this.updateState({ isReady: true, isConnected: true })
        resolve(true)
      })

      this.player.addListener('not_ready', () => {
        console.log('[SPOTIFY] Player not ready')
        this.deviceId = null
        this.updateState({ isReady: false })
      })

      this.player.addListener('player_state_changed', (state: any) => {
        if (!state) {
          this.updateState({ isPlaying: false, currentTrack: null })
          return
        }

        const track = state.track_window?.current_track
        this.updateState({
          isPlaying: !state.paused,
          position: state.position,
          duration: state.duration,
          currentTrack: track ? {
            uri: track.uri,
            name: track.name,
            artist: track.artists.map((a: any) => a.name).join(', '),
            album: track.album.name,
            albumArt: track.album.images?.[0]?.url ?? '',
            duration: state.duration,
          } : null,
        })
      })

      this.player.addListener('initialization_error', ({ message }: { message: string }) => {
        console.error('[SPOTIFY] Init error:', message)
        resolve(false)
      })

      this.player.addListener('authentication_error', ({ message }: { message: string }) => {
        console.error('[SPOTIFY] Auth error:', message)
        this.updateState({ isConnected: false })
        resolve(false)
      })

      this.player.addListener('account_error', ({ message }: { message: string }) => {
        console.error('[SPOTIFY] Account error:', message)
        resolve(false)
      })

      this.player.connect()
    })
  }

  // ─── Audio routing for visualizer ────────────────────────────────────────

  /** Connect Spotify audio to an AnalyserNode for the visualizer.
   *  The SDK plays through an internal <audio> element. We find it and
   *  route it through our AudioContext. */
  connectToAnalyser(audioCtx: AudioContext): AnalyserNode {
    if (this.analyser) return this.analyser

    this.audioCtx = audioCtx
    this.analyser = audioCtx.createAnalyser()
    this.analyser.fftSize = 2048

    // The Spotify SDK creates a hidden <audio> element. Find and tap it.
    this.tryConnectAudioElement()

    return this.analyser
  }

  private tryConnectAudioElement(): void {
    // Observe DOM for the Spotify SDK's audio element
    const observer = new MutationObserver(() => {
      const audioEl = document.querySelector('audio[src*="scdn"]') as HTMLAudioElement
        ?? document.querySelector('audio') as HTMLAudioElement

      if (audioEl && this.audioCtx && this.analyser && !this.sourceNode) {
        try {
          this.sourceNode = this.audioCtx.createMediaElementSource(audioEl)
          this.sourceNode.connect(this.analyser)
          this.analyser.connect(this.audioCtx.destination)
          console.log('[SPOTIFY] Audio element connected to analyser')
          observer.disconnect()
        } catch (e) {
          // Element may already have a source — that's fine, the audio
          // still plays through the default destination
          console.warn('[SPOTIFY] Could not tap audio element:', e)
          observer.disconnect()
        }
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    // Also check immediately
    const audioEl = document.querySelector('audio') as HTMLAudioElement
    if (audioEl && this.audioCtx && this.analyser && !this.sourceNode) {
      try {
        this.sourceNode = this.audioCtx.createMediaElementSource(audioEl)
        this.sourceNode.connect(this.analyser)
        this.analyser.connect(this.audioCtx.destination)
        console.log('[SPOTIFY] Audio element connected to analyser (immediate)')
      } catch { /* ignore */ }
    }
  }

  getAnalyserNode(): AnalyserNode | null {
    return this.analyser
  }

  // ─── Playback controls ──────────────────────────────────────────────────

  async play(uri?: string): Promise<void> {
    if (!this.deviceId) return
    const token = await (window as any).api?.spotifyGetAccessToken()
    if (!token) return

    if (uri) {
      // Play specific track or context (playlist)
      const body: any = {}
      if (uri.includes('playlist')) {
        body.context_uri = uri
      } else {
        body.uris = [uri]
      }

      await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
    } else {
      this.player?.resume()
    }
  }

  async pause(): Promise<void> {
    this.player?.pause()
  }

  async togglePlay(): Promise<void> {
    this.player?.togglePlay()
  }

  async nextTrack(): Promise<void> {
    this.player?.nextTrack()
  }

  async previousTrack(): Promise<void> {
    this.player?.previousTrack()
  }

  async seek(positionMs: number): Promise<void> {
    this.player?.seek(positionMs)
  }

  async setVolume(value: number): Promise<void> {
    this.player?.setVolume(Math.max(0, Math.min(1, value)))
  }

  // ─── Spotify Web API calls ──────────────────────────────────────────────

  async fetchPlaylists(): Promise<SpotifyPlaylist[]> {
    const token = await (window as any).api?.spotifyGetAccessToken()
    if (!token) return []

    const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (!res.ok) return []

    const data = await res.json()
    return (data.items ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      imageUrl: p.images?.[0]?.url ?? '',
      trackCount: p.tracks?.total ?? 0,
    }))
  }

  async fetchPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
    const token = await (window as any).api?.spotifyGetAccessToken()
    if (!token) return []

    const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (!res.ok) return []

    const data = await res.json()
    return (data.items ?? [])
      .filter((item: any) => item.track)
      .map((item: any) => ({
        uri: item.track.uri,
        name: item.track.name,
        artist: item.track.artists?.map((a: any) => a.name).join(', ') ?? 'Unknown',
        album: item.track.album?.name ?? '',
        albumArt: item.track.album?.images?.[0]?.url ?? '',
        duration: item.track.duration_ms,
      }))
  }

  // ─── State management ───────────────────────────────────────────────────

  private updateState(partial: Partial<SpotifyPlayerState>): void {
    this.state = { ...this.state, ...partial }
    this.listeners.forEach((fn) => fn(this.state))
  }

  getState(): SpotifyPlayerState {
    return this.state
  }

  subscribe(fn: SpotifyStateListener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────

  disconnect(): void {
    this.player?.disconnect()
    this.player = null
    this.deviceId = null
    this.sourceNode = null
    this.analyser = null
    this.updateState({
      isPlaying: false,
      isConnected: false,
      isReady: false,
      currentTrack: null,
    })
  }
}

export const spotifyPlayer = new SpotifyPlayerService()
