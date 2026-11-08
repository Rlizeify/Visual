export interface MusicData {
  isPlaying: boolean
  trackId: string | null
  trackName: string
  artistName: string
  artistNames: string[]
  albumArt: string
  progress: number
  duration: number
  shuffleState: boolean
  pollTimestamp: number
  serverTimestamp: number
}
