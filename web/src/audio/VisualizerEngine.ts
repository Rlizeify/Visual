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
  private lastBeatTime = 0
  private stopTime = 0 // When playback stopped (for decay)

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

  // Find current beat and calculate beat pulse with fast decay
  private calculateBeatPulse(timeSec: number): { beatPulse: number; anticipation: number } {
    const analysis = getAnalysis()
    if (!analysis || analysis.beats.length === 0) {
      return { beatPulse: 0, anticipation: 0 }
    }

    const beats = analysis.beats

    // Find current beat index
    while (this.currentBeatIndex < beats.length - 1 && timeSec >= beats[this.currentBeatIndex + 1].start) {
      this.currentBeatIndex++
      this.lastBeatTime = beats[this.currentBeatIndex].start
    }

    // Handle case where we've seeked backwards
    if (this.currentBeatIndex > 0 && timeSec < beats[this.currentBeatIndex].start) {
      this.currentBeatIndex = 0
      for (let i = 0; i < beats.length; i++) {
        if (beats[i].start <= timeSec) {
          this.currentBeatIndex = i
          this.lastBeatTime = beats[i].start
        } else break
      }
    }

    // Calculate time since last beat
    const timeSinceLastBeat = Math.max(0, timeSec - this.lastBeatTime)

    // Sharp attack, fast decay: exp(-8 * t)
    const beatPulse = Math.exp(-8 * timeSinceLastBeat)

    // Calculate anticipation (buildup before next beat)
    let anticipation = 0
    if (this.currentBeatIndex < beats.length - 1) {
      const nextBeatTime = beats[this.currentBeatIndex + 1].start
      const timeToNextBeat = nextBeatTime - timeSec
      const beatInterval = nextBeatTime - beats[this.currentBeatIndex].start
      if (beatInterval > 0 && timeToNextBeat > 0 && timeToNextBeat < beatInterval * 0.3) {
        // Ramp up in the last 30% before the beat
        anticipation = (1 - timeToNextBeat / (beatInterval * 0.3)) * 0.3
      }
    }

    return { beatPulse, anticipation }
  }

  // Clamp value to 0-255
  private clamp255(val: number): number {
    return Math.max(0, Math.min(255, Math.floor(val)))
  }

  // Average helper
  private avg(...vals: number[]): number {
    const valid = vals.filter(v => v !== undefined && !isNaN(v))
    if (valid.length === 0) return 0
    return valid.reduce((a, b) => a + b, 0) / valid.length
  }

  // Update synthetic audio data from Spotify analysis - called every animation frame
  private updateMusicData(): void {
    const musicData = getMusicData()
    const timeSec = getInterpolatedProgress() / 1000
    const segment = this.findCurrentSegment(timeSec)
    const now = Date.now()

    // Shimmer effect: subtle variation on all values
    const shimmer = Math.sin(now * 0.003) * 0.15

    if (!musicData.isPlaying || !segment) {
      // Track when playback stopped
      if (musicData.isPlaying === false && this.stopTime === 0) {
        this.stopTime = now
      }

      // Decay to 0 over 2 seconds when not playing
      const timeSinceStopped = (now - this.stopTime) / 1000
      const decayFactor = Math.max(0, 1 - timeSinceStopped / 2)

      for (let i = 0; i < 2048; i++) {
        this.frequencyData[i] = this.clamp255(this.frequencyData[i] * decayFactor * 0.95)
        this.timeDomainData[i] = 128
      }

      window.__musicData = {
        loudness: 0,
        pitches: [],
        timbre: [],
        beatPulse: 0,
        bassVal: 0,
      }
      return
    }

    // Reset stop time when playing
    this.stopTime = 0

    const pitches = segment.pitches || []
    const timbre = segment.timbre || []

    // Normalize loudness (typically -60 to 0 dB) to 0-1
    const loudnessNorm = Math.max(0, Math.min(1, (segment.loudness_max + 60) / 60))

    // Calculate beat pulse with fast decay
    const { beatPulse, anticipation } = this.calculateBeatPulse(timeSec)

    // Apply reactivity settings
    const bassMultiplier = this.settings.bassReactivity / 50
    const midMultiplier = this.settings.midReactivity / 50
    const highMultiplier = this.settings.highReactivity / 50

    // Bass (0-10): loudness * beatPulse + shimmer
    const bassVal = this.clamp255(
      Math.max(20, loudnessNorm * 255 * (beatPulse + anticipation) + shimmer * 30) * bassMultiplier
    )
    for (let i = 0; i <= 10; i++) {
      this.frequencyData[i] = bassVal
    }

    // Low-mid (11-100): pitches[0,1,2] avg * 220 * (0.2 + 0.8*beatPulse) + shimmer
    const lowMidAvg = this.avg(pitches[0], pitches[1], pitches[2])
    const lowMidVal = this.clamp255(
      Math.max(40, lowMidAvg * 220 * (0.2 + 0.8 * (beatPulse + anticipation)) + shimmer * 20) * midMultiplier
    )
    for (let i = 11; i <= 100; i++) {
      this.frequencyData[i] = lowMidVal
    }

    // Mid (101-300): pitches[3,4,5] avg * 200 + shimmer
    const midAvg = this.avg(pitches[3], pitches[4], pitches[5])
    const midVal = this.clamp255(
      Math.max(40, midAvg * 200 + shimmer * 25) * midMultiplier
    )
    for (let i = 101; i <= 300; i++) {
      this.frequencyData[i] = midVal
    }

    // High-mid (301-600): pitches[6,7,8] avg * 180 + shimmer
    const highMidAvg = this.avg(pitches[6], pitches[7], pitches[8])
    const highMidVal = this.clamp255(
      Math.max(30, highMidAvg * 180 + shimmer * 20) * highMultiplier
    )
    for (let i = 301; i <= 600; i++) {
      this.frequencyData[i] = highMidVal
    }

    // High (601-1024): pitches[9,10,11] avg * 160 + shimmer
    const highAvg = this.avg(pitches[9], pitches[10], pitches[11])
    const highVal = this.clamp255(
      Math.max(30, highAvg * 160 + shimmer * 15) * highMultiplier
    )
    for (let i = 601; i <= 1024; i++) {
      this.frequencyData[i] = highVal
    }

    // Air (1025-2047): abs(timbre[1]) * 2 + shimmer
    // timbre[1] is "brightness" - negative = dull, positive = bright
    const timbre1 = timbre[1] !== undefined ? timbre[1] : 0
    const airVal = this.clamp255(Math.abs(timbre1) * 2 + shimmer * 10)
    for (let i = 1025; i < 2048; i++) {
      this.frequencyData[i] = airVal
    }

    // Generate time domain data (waveform): 128 + bassVal*0.3*sin wave
    for (let i = 0; i < 2048; i++) {
      const phase = (i / 2048) * Math.PI * 8 + timeSec * 10
      const amplitude = bassVal * 0.3
      this.timeDomainData[i] = this.clamp255(128 + Math.sin(phase) * amplitude)
    }

    // Expose debug data
    window.__musicData = {
      loudness: loudnessNorm,
      pitches: pitches.slice(),
      timbre: timbre.slice(),
      beatPulse: beatPulse,
      bassVal: bassVal,
    }
  }

  private startRenderLoop(): void {
    let lastTimestamp = 0
    const render = (timestamp: number) => {
      if (!this.visualizer) return

      // Update synthetic audio data BEFORE rendering - every frame
      this.updateMusicData()

      // Log RAF delta once per second to verify ~16 ms / 60 fps
      const now = performance.now()
      if (now - this.lastLogTime >= 1000) {
        const delta = lastTimestamp > 0 ? timestamp - lastTimestamp : 0
        const fps = delta > 0 ? (1000 / delta).toFixed(1) : '—'
        console.log(`[VisualizerEngine] RAF delta: ${delta.toFixed(1)}ms (${fps}fps)`)
        const first5 = Array.from(this.frequencyData.slice(0, 5))
        console.log('[VisualizerEngine] Freq[0..4]:', first5.join(' '))
        this.lastLogTime = now
      }
      lastTimestamp = timestamp

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
