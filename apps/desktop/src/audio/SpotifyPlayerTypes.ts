/** Shared types for the Spotify player subsystem. */

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

export type SpotifyStateListener = (state: SpotifyPlayerState) => void

export interface SpotifyPlayerState {
  isPlaying: boolean
  isConnected: boolean
  isReady: boolean
  currentTrack: SpotifyTrack | null
  position: number
  duration: number
}
