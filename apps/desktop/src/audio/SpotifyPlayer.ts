/* SpotifyPlayer.ts — Spotify Web Playback SDK service singleton. */
import type { SpotifyPlayerState, SpotifyStateListener, SpotifyTrack } from './SpotifyPlayerTypes'
import { fetchPlaylists, fetchPlaylistTracks, playSpotifyUri } from './SpotifyPlayerAPI'
import { connectToAnalyser, getAnalyserNode, resetAudioRouting } from './SpotifyPlayerAudio'

export type { SpotifyTrack, SpotifyPlayerState }
export type { SpotifyPlaylist } from './SpotifyPlayerTypes'

class SpotifyPlayerService {
  private player: any = null
  private deviceId: string | null = null
  private sdkLoaded = false
  private sdkLoadPromise: Promise<void> | null = null
  private listeners: Set<SpotifyStateListener> = new Set()

  private state: SpotifyPlayerState = {
    isPlaying: false, isConnected: false, isReady: false,
    currentTrack: null, position: 0, duration: 0,
  }

  // ─── SDK loading ──────────────────────────────────────────────────────────

  loadSDK(): Promise<void> {
    if (this.sdkLoaded) return Promise.resolve()
    if (this.sdkLoadPromise) return this.sdkLoadPromise
    this.sdkLoadPromise = new Promise<void>((resolve) => {
      window.onSpotifyWebPlaybackSDKReady = () => { this.sdkLoaded = true; resolve() }
      const script = document.createElement('script')
      script.src = 'https://sdk.scdn.co/spotify-player.js'
      script.async = true
      document.head.appendChild(script)
    })
    return this.sdkLoadPromise
  }

  // ─── Player init ──────────────────────────────────────────────────────────

  async init(accessToken: string): Promise<boolean> {
    await this.loadSDK()
    if (this.player) this.player.disconnect()
    const api = (window as any).api
    this.player = new window.Spotify.Player({
      name: 'MHEU Visual',
      getOAuthToken: async (cb: (token: string) => void) => {
        const token = await api?.spotifyGetAccessToken()
        cb(token ?? accessToken)
      },
      volume: 0.5,
    })
    return new Promise<boolean>((resolve) => {
      this.player.addListener('ready', ({ device_id }: { device_id: string }) => {
        console.log('[SPOTIFY] Player ready:', device_id)
        this.deviceId = device_id
        this.updateState({ isReady: true, isConnected: true })
        resolve(true)
      })
      this.player.addListener('not_ready', () => {
        this.deviceId = null; this.updateState({ isReady: false })
      })
      this.player.addListener('player_state_changed', (s: any) => {
        if (!s) { this.updateState({ isPlaying: false, currentTrack: null }); return }
        const t = s.track_window?.current_track
        const currentTrack: SpotifyTrack | null = t ? {
          uri: t.uri, name: t.name,
          artist: t.artists.map((a: any) => a.name).join(' / '),
          album: t.album.name,
          albumArt: t.album.images?.[0]?.url ?? '',
          duration: s.duration,
        } : null
        this.updateState({ isPlaying: !s.paused, position: s.position, duration: s.duration, currentTrack })
      })
      this.player.addListener('initialization_error', ({ message }: { message: string }) => {
        console.error('[SPOTIFY] Init error:', message); resolve(false)
      })
      this.player.addListener('authentication_error', ({ message }: { message: string }) => {
        console.error('[SPOTIFY] Auth error:', message)
        this.updateState({ isConnected: false }); resolve(false)
      })
      this.player.addListener('account_error', ({ message }: { message: string }) => {
        console.error('[SPOTIFY] Account error:', message); resolve(false)
      })
      this.player.connect()
    })
  }

  // ─── Web API ──────────────────────────────────────────────────────────────

  fetchPlaylists = fetchPlaylists
  fetchPlaylistTracks = fetchPlaylistTracks

  // ─── Playback ─────────────────────────────────────────────────────────────

  async play(uri?: string): Promise<void> {
    if (!this.deviceId) return
    if (uri) { await playSpotifyUri(this.deviceId, uri) }
    else { this.player?.resume() }
  }

  pause(): void { this.player?.pause() }
  togglePlay(): void { this.player?.togglePlay() }
  nextTrack(): void { this.player?.nextTrack() }
  previousTrack(): void { this.player?.previousTrack() }
  seek(ms: number): void { this.player?.seek(ms) }
  setVolume(v: number): void { this.player?.setVolume(Math.max(0, Math.min(1, v))) }

  // ─── Audio routing ────────────────────────────────────────────────────────

  connectToAnalyser(audioCtx: AudioContext): AnalyserNode { return connectToAnalyser(audioCtx) }
  getAnalyserNode(): AnalyserNode | null { return getAnalyserNode() }

  // ─── State ────────────────────────────────────────────────────────────────

  private updateState(partial: Partial<SpotifyPlayerState>): void {
    this.state = { ...this.state, ...partial }
    this.listeners.forEach((fn) => fn(this.state))
  }

  getState(): SpotifyPlayerState { return this.state }

  subscribe(fn: SpotifyStateListener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  markTokenValid(hasToken: boolean): void { this.updateState({ isConnected: hasToken }) }

  disconnect(): void {
    this.player?.disconnect()
    this.player = null
    this.deviceId = null
    resetAudioRouting()
    this.updateState({ isPlaying: false, isConnected: false, isReady: false, currentTrack: null })
  }
}

export const spotifyPlayer = new SpotifyPlayerService()
