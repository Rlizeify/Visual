export interface AudioAnalysisBeat {
  start: number
  duration: number
  confidence: number
}

export interface AudioAnalysisSegment {
  start: number
  duration: number
  confidence: number
  loudness_start: number
  loudness_max: number
  loudness_max_time: number
  loudness_end: number
  pitches: number[]
  timbre: number[]
}

export interface AudioAnalysisSection {
  start: number
  duration: number
  confidence: number
  loudness: number
  tempo: number
  key: number
  mode: number
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

export interface MusicData {
  isPlaying: boolean
  trackId: string | null
  trackName: string
  artistName: string
  albumArt: string
  progress: number
  duration: number
  tempo: number
  shuffleState: boolean
  pollTimestamp: number
  serverTimestamp: number
}
