// Butterchurn visualizer engine with fake AnalyserNode for Spotify audio analysis data
import butterchurn from 'butterchurn'
import butterchurnPresets from 'butterchurn-presets'
import { getAnalysis, getMusicData, getInterpolatedProgress } from './SpotifyWebPlayer'

export interface VisualizerSettings {
  bassReactivity: number
  midReactivity: number
  highReactivity: number
  animationSpeed: number
  blendTime: number
  cycleSpeed: number
}

const DEFAULT_SETTINGS: VisualizerSettings = {
  bassReactivity: 50,
  midReactivity: 50,
  highReactivity: 50,
  animationSpeed: 1,
  blendTime: 2.5,
  cycleSpeed: 30,
}

// Debug window interface
declare global {
  interface Window {
    __musicData?: {
      loudness: number
      pitches: number[]
      timbre: number[]
      beatPulse: number
      bassVal: number
    }
  }
}

class VisualizerEngine {
  private canvas: HTMLCanvasElement | null = null
  private visualizer: ReturnType<typeof butterchurn.createVisualizer> | null = null
  private presets: Record<string, unknown> = {}
  private presetKeys: string[] = []
  private currentPresetIndex = 0
  private settings: VisualizerSettings = { ...DEFAULT_SETTINGS }
  private animationFrame: number | null = null
  private cycleInterval: ReturnType<typeof setInterval> | null = null
  private lastLogTime = 0

  // Fake AnalyserNode for Butterchurn
  private audioContext: AudioContext | null = null
  private fakeAnalyser: AnalyserNode | null = null
  private frequencyData: Uint8Array = new Uint8Array(2048)
  private timeDomainData: Uint8Array = new Uint8Array(2048)

  // Beat tracking
  private currentBeatIndex = 0
  private beatPulse = 0
  private lastBeatTime = 0

  constructor() {
    this.presets = butterchurnPresets.getPresets()
    this.presetKeys = Object.keys(this.presets)
  }

  getPresetKeys(): string[] {
    return this.presetKeys
  }

  getCurrentPreset(): string {
    return this.presetKeys[this.currentPresetIndex] || ''
  }

  getSettings(): VisualizerSettings {
    return { ...this.settings }
  }

  initialize(canvas: HTMLCanvasElement): void {
    this.canvas = canvas

    // Create real AudioContext and AnalyserNode
    this.audioContext = new AudioContext()
    this.fakeAnalyser = this.audioContext.createAnalyser()
    this.fakeAnalyser.fftSize = 4096
    this.fakeAnalyser.smoothingTimeConstant = 0.3

    // Override getByteFrequencyData to return our synthetic data
    const self = this
    this.fakeAnalyser.getByteFrequencyData = function(array: Uint8Array) {
      // Copy our synthetic frequency data into the provided array
      const len = Math.min(array.length, self.frequencyData.length)
      for (let i = 0; i < len; i++) {
        array[i] = self.frequencyData[i]
      }
    }

    // Override getByteTimeDomainData to return our synthetic data
    this.fakeAnalyser.getByteTimeDomainData = function(array: Uint8Array) {
      // Copy our synthetic time domain data into the provided array
      const len = Math.min(array.length, self.timeDomainData.length)
      for (let i = 0; i < len; i++) {
        array[i] = self.timeDomainData[i]
      }
    }

    // Create visualizer with the audio context
    this.visualizer = butterchurn.createVisualizer(this.audioContext, canvas, {
      width: canvas.width,
      height: canvas.height,
      meshWidth: 48,
      meshHeight: 36,
      pixelRatio: window.devicePixelRatio || 1,
    })

    // Connect the fake analyser to Butterchurn
    this.visualizer.connectAudio(this.fakeAnalyser)

    if (this.presetKeys.length > 0) {
      this.loadPreset(this.presetKeys[0])
    }

    this.startCycleTimer()
    this.startRenderLoop()
  }

  resize(width: number, height: number): void {
    if (this.canvas && this.visualizer) {
      this.canvas.width = width
      this.canvas.height = height
      this.visualizer.setRendererSize(width, height)
    }
  }

  loadPreset(presetName: string, blendTime?: number): void {
    if (!this.visualizer || !this.presets[presetName]) return
    const blend = blendTime ?? this.settings.blendTime
    this.visualizer.loadPreset(this.presets[presetName], blend)
    this.currentPresetIndex = this.presetKeys.indexOf(presetName)
  }

  nextPreset(): void {
    this.currentPresetIndex = (this.currentPresetIndex + 1) % this.presetKeys.length
    this.loadPreset(this.presetKeys[this.currentPresetIndex])
  }

  previousPreset(): void {
    this.currentPresetIndex = (this.currentPresetIndex - 1 + this.presetKeys.length) % this.presetKeys.length
    this.loadPreset(this.presetKeys[this.currentPresetIndex])
  }

  setPresetByIndex(index: number): void {
    if (index >= 0 && index < this.presetKeys.length) {
      this.currentPresetIndex = index
      this.loadPreset(this.presetKeys[index])
    }
  }

  updateSettings(newSettings: Partial<VisualizerSettings>): void {
    this.settings = { ...this.settings, ...newSettings }
    if ('cycleSpeed' in newSettings) {
      this.startCycleTimer()
    }
  }

  private startCycleTimer(): void {
    if (this.cycleInterval) clearInterval(this.cycleInterval)
    this.cycleInterval = setInterval(() => {
      this.nextPreset()
    }, this.settings.cycleSpeed * 1000)
  }

  // Find current segment at given time (seconds)
  private findCurrentSegment(timeSec: number) {
    const analysis = getAnalysis()
    if (!analysis) return null
    for (let i = analysis.segments.length - 1; i >= 0; i--) {
      const seg = analysis.segments[i]
      if (timeSec >= seg.start) return seg
    }
    return analysis.segments[0] || null
  }

  // Update beat pulse with exponential decay
  private updateBeatPulse(timeSec: number): void {
    const analysis = getAnalysis()
    if (!analysis || analysis.beats.length === 0) {
      // Exponential decay with time constant 0.3s
      this.beatPulse *= Math.exp(-1 / 0.3 / 60) // Assuming ~60fps
      return
    }

    const beats = analysis.beats

    // Find current beat index
    while (this.currentBeatIndex < beats.length - 1 && timeSec >= beats[this.currentBeatIndex + 1].start) {
      this.currentBeatIndex++
      this.beatPulse = 1.0 // Sharp attack on beat
      this.lastBeatTime = timeSec
    }

    // Handle case where we've seeked backwards
    if (this.currentBeatIndex > 0 && timeSec < beats[this.currentBeatIndex].start) {
      this.currentBeatIndex = 0
      for (let i = 0; i < beats.length; i++) {
        if (beats[i].start <= timeSec) this.currentBeatIndex = i
        else break
      }
    }

    // Exponential decay with time constant 0.3s
    const timeSinceBeat = timeSec - this.lastBeatTime
    if (timeSinceBeat > 0) {
      this.beatPulse = Math.exp(-timeSinceBeat / 0.3)
    }

    this.beatPulse = Math.max(0, Math.min(1, this.beatPulse))
  }

  // Clamp value to 0-255
  private clamp255(val: number): number {
    return Math.max(0, Math.min(255, Math.floor(val)))
  }

  // Update synthetic audio data from Spotify analysis
  private updateMusicData(): void {
    const musicData = getMusicData()
    const timeSec = getInterpolatedProgress() / 1000
    const segment = this.findCurrentSegment(timeSec)

    this.updateBeatPulse(timeSec)

    if (!segment || !musicData.isPlaying) {
      // Decay to silence when not playing
      for (let i = 0; i < 2048; i++) {
        this.frequencyData[i] = this.clamp255(this.frequencyData[i] * 0.9)
        this.timeDomainData[i] = 128 // Silence center line
      }
      window.__musicData = {
        loudness: 0,
        pitches: [],
        timbre: [],
        beatPulse: this.beatPulse,
        bassVal: 0,
      }
      return
    }

    const pitches = segment.pitches || []
    const timbre = segment.timbre || []

    // Normalize loudness (typically -60 to 0 dB) to 0-1
    const loudnessNorm = Math.max(0, Math.min(1, (segment.loudness_max + 60) / 60))

    // bassVal = loudness_normalized * 255 * beatPulse
    const bassVal = this.clamp255(loudnessNorm * 255 * this.beatPulse)

    // Apply reactivity settings
    const bassMultiplier = this.settings.bassReactivity / 50
    const midMultiplier = this.settings.midReactivity / 50
    const highMultiplier = this.settings.highReactivity / 50

    // Indices 0-10: bassVal (strong bass on beats)
    for (let i = 0; i <= 10; i++) {
      this.frequencyData[i] = this.clamp255(bassVal * bassMultiplier)
    }

    // Indices 11-100: pitches[0..2] average * 220 * (0.3 + 0.7 * beatPulse)
    const lowPitchAvg = (pitches[0] + pitches[1] + pitches[2]) / 3 || 0
    const lowMidVal = this.clamp255(lowPitchAvg * 220 * (0.3 + 0.7 * this.beatPulse) * midMultiplier)
    for (let i = 11; i <= 100; i++) {
      this.frequencyData[i] = lowMidVal
    }

    // Indices 101-500: pitches[3..7] average * 180
    const midPitchAvg = (pitches[3] + pitches[4] + pitches[5] + pitches[6] + pitches[7]) / 5 || 0
    const midVal = this.clamp255(midPitchAvg * 180 * midMultiplier)
    for (let i = 101; i <= 500; i++) {
      this.frequencyData[i] = midVal
    }

    // Indices 501-1024: pitches[8..11] average * 150
    const highPitchAvg = (pitches[8] + pitches[9] + pitches[10] + pitches[11]) / 4 || 0
    const highVal = this.clamp255(highPitchAvg * 150 * highMultiplier)
    for (let i = 501; i <= 1024; i++) {
      this.frequencyData[i] = highVal
    }

    // Indices 1025-2047: timbre[0] normalized * 100
    // Timbre values typically range from -100 to 100, with first value being overall loudness
    const timbreNorm = timbre[0] !== undefined ? (timbre[0] + 100) / 200 : 0.5
    const timbreVal = this.clamp255(timbreNorm * 100)
    for (let i = 1025; i < 2048; i++) {
      this.frequencyData[i] = timbreVal
    }

    // Generate time domain data (waveform) - simple sine wave modulated by bass
    for (let i = 0; i < 2048; i++) {
      const phase = (i / 2048) * Math.PI * 8 + timeSec * 10
      const amplitude = 50 * this.beatPulse * loudnessNorm
      this.timeDomainData[i] = this.clamp255(128 + Math.sin(phase) * amplitude)
    }

    // Expose debug data
    window.__musicData = {
      loudness: loudnessNorm,
      pitches: pitches.slice(),
      timbre: timbre.slice(),
      beatPulse: this.beatPulse,
      bassVal: bassVal,
    }
  }

  private startRenderLoop(): void {
    const render = () => {
      if (!this.visualizer) return

      // Update synthetic audio data BEFORE rendering
      this.updateMusicData()

      // Log once per second for debugging
      const now = performance.now()
      if (now - this.lastLogTime >= 1000) {
        const first5 = Array.from(this.frequencyData.slice(0, 5))
        console.log('[VisualizerEngine] Freq[0..4]:', first5.join(' '))
        this.lastLogTime = now
      }

      this.visualizer.render()
      this.animationFrame = requestAnimationFrame(render)
    }
    this.animationFrame = requestAnimationFrame(render)
  }

  destroy(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }
    if (this.cycleInterval) {
      clearInterval(this.cycleInterval)
      this.cycleInterval = null
    }
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    this.fakeAnalyser = null
    this.visualizer = null
    this.canvas = null
  }
}

// Singleton
let engine: VisualizerEngine | null = null

export function getVisualizerEngine(): VisualizerEngine {
  if (!engine) engine = new VisualizerEngine()
  return engine
}

export function destroyVisualizerEngine(): void {
  if (engine) {
    engine.destroy()
    engine = null
  }
}
