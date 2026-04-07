/** SpotifyPlayer.ts — Web API control + polling. No Web Playback SDK. */
import type { SpotifyPlayerState, SpotifyStateListener, SpotifyTrack } from './SpotifyPlayerTypes'
import { fetchPlaylists, fetchPlaylistTracks } from './SpotifyPlayerAPI'
import {
  playTrackUri, pausePlayback, resumePlayback,
  skipToNext, skipToPrevious, getDevices, getNowPlaying,
} from './SpotifyPlayerControls'
import { connectToAnalyser, getAnalyserNode, resetAudioRouting } from './SpotifyPlayerAudio'

export type { SpotifyTrack, SpotifyPlayerState }
export type { SpotifyPlaylist } from './SpotifyPlayerTypes'

class SpotifyPlayerService {
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private listeners: Set<SpotifyStateListener> = new Set()

  private state: SpotifyPlayerState = {
    isPlaying: false, isConnected: false, isReady: false,
    currentTrack: null, position: 0, duration: 0,
  }

  markTokenValid(hasToken: boolean): void {
    this.updateState({ isConnected: hasToken, isReady: hasToken })
    if (hasToken) this.startPolling()
    else this.stopPolling()
  }

  private startPolling(): void {
    if (this.pollTimer) return
    void this.poll()
    this.pollTimer = setInterval(() => { void this.poll() }, 2000)
  }

  private stopPolling(): void {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null }
  }

  private async poll(): Promise<void> {
    const data = await getNowPlaying()
    if (!data) { this.updateState({ isPlaying: false, currentTrack: null }); return }
    const t = data.item
    this.updateState({
      isPlaying: !!data.is_playing,
      position: data.progress_ms ?? 0,
      duration: t?.duration_ms ?? 0,
      currentTrack: t ? {
        uri: t.uri as string,
        name: t.name as string,
        artist: (t.artists as Array<{ name: string }>).map((a) => a.name).join(' / '),
        album: (t.album as { name: string }).name,
        albumArt: (t.album as { images?: Array<{ url: string }> }).images?.[0]?.url ?? '',
        duration: t.duration_ms as number,
      } satisfies SpotifyTrack : null,
    })
  }

  // ─── Web API ──────────────────────────────────────────────────────────────

  fetchPlaylists = fetchPlaylists
  fetchPlaylistTracks = fetchPlaylistTracks
  getDevices = getDevices

  async play(uri?: string): Promise<void> {
    if (uri) await playTrackUri(uri)
    else await resumePlayback()
  }

  async pause(): Promise<void> { await pausePlayback() }

  async togglePlay(): Promise<void> {
    if (this.state.isPlaying) await pausePlayback()
    else await resumePlayback()
  }

  async nextTrack(): Promise<void> { await skipToNext() }
  async previousTrack(): Promise<void> { await skipToPrevious() }

  // ─── Audio routing ────────────────────────────────────────────────────────

  connectToAnalyser(ctx: AudioContext): AnalyserNode { return connectToAnalyser(ctx) }
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

  disconnect(): void {
    this.stopPolling()
    resetAudioRouting()
    this.updateState({ isPlaying: false, isConnected: false, isReady: false, currentTrack: null })
  }
}

export const spotifyPlayer = new SpotifyPlayerService()
