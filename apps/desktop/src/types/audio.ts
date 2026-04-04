export interface AudioState {
  isLoaded: boolean
  isPlaying: boolean
  currentTime: number
  duration: number
  filename: string
}

export interface BeatData {
  bass: number
  mid: number
  high: number
  energy: number
}

export interface DialSettings {
  speed: number
  weight: number
  texture: number
  brightness: number
}
