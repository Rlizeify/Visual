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
  bpm?: number
}

export interface DialSettings {
  speed: number
  weight: number
  texture: number
  brightness: number
}

export type AppMode = 'mp3' | 'synth'

export interface ActiveWave {
  id: string
  type: 'sine' | 'sawtooth' | 'triangle' | 'square'
  amplitude: number
  frequency: number
}
