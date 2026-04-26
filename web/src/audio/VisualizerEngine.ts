// Butterchurn visualizer engine with fake AnalyserNode for Spotify audio analysis data
import butterchurn from 'butterchurn'
import butterchurnPresets from 'butterchurn-presets'
import { getAnalysis, getMusicData, getInterpolatedProgress, isBpmFallback } from './SpotifyWebPlayer'

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
  private lastKickedBeatIndex = -1 // avoids double-firing kick for same beat
  private beatKickDecay = 0        // 0-1, set to 1.0 on kick, decays per frame
  private stopTime = 0             // When playback stopped (for decay)

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

  // Beat scheduler: runs every RAF frame, checks localPosition against beats array.
  // Fires a kick when we enter the 50ms window after a beat start (once per beat).
  // Falls back to BPM-driven synthetic beats when audio analysis is unavailable.
  private runBeatScheduler(timeSec: number): { beatPulse: number; kicked: boolean } {
    const analysis = getAnalysis()

    // BPM fallback: no analysis — synthesise beats from tempo
    if (isBpmFallback() || !analysis || analysis.beats.length === 0) {
      const tempo = getMusicData().tempo || 120
      const beatIntervalSec = 60 / tempo
      const beatIdx = Math.floor(timeSec / beatIntervalSec)
      const phaseInBeatSec = timeSec - beatIdx * beatIntervalSec
      const phaseMs = phaseInBeatSec * 1000

      const kicked = phaseMs < 50 && beatIdx !== this.lastKickedBeatIndex
      if (kicked) this.lastKickedBeatIndex = beatIdx

      return { beatPulse: Math.exp(-8 * phaseInBeatSec), kicked }
    }

    const beats = analysis.beats

    // Advance beat index forward
    while (this.currentBeatIndex < beats.length - 1 && timeSec >= beats[this.currentBeatIndex + 1].start) {
      this.currentBeatIndex++
      this.lastBeatTime = beats[this.currentBeatIndex].start
    }

    // Handle seek backwards — reset kick tracking
    if (this.currentBeatIndex > 0 && timeSec < beats[this.currentBeatIndex].start) {
      this.currentBeatIndex = 0
      for (let i = 0; i < beats.length; i++) {
        if (beats[i].start <= timeSec) {
          this.currentBeatIndex = i
          this.lastBeatTime = beats[i].start
        } else break
      }
      this.lastKickedBeatIndex = -1
    }

    // Fire kick when within 50ms after beat start, once per beat
    const currentBeat = beats[this.currentBeatIndex]
    const msSinceBeat = (timeSec - currentBeat.start) * 1000
    const kicked = msSinceBeat >= 0 && msSinceBeat < 50 && this.currentBeatIndex !== this.lastKickedBeatIndex
    if (kicked) this.lastKickedBeatIndex = this.currentBeatIndex

    const beatPulse = Math.exp(-8 * Math.max(0, timeSec - this.lastBeatTime))
    return { beatPulse, kicked }
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

  // Update synthetic audio data from Spotify analysis — called every animation frame.
  // Feeds loudness_max (mapped 0-1) and beat-kicked frequency data into Butterchurn.
  private updateMusicData(): void {
    const musicData = getMusicData()
    // localPosition uses clock-drift correction (Date.now() - serverTimestamp) in SpotifyWebPlayer
    const timeSec = getInterpolatedProgress() / 1000
    const now = Date.now()
    const shimmer = Math.sin(now * 0.003) * 0.15

    // Beat scheduler runs every frame — drives kick even when no segment data
    const { beatPulse, kicked } = this.runBeatScheduler(timeSec)
    if (kicked) this.beatKickDecay = 1.0
    this.beatKickDecay *= 0.85  // decays to ~0 in ~10 frames at 60fps

    // Kick boost: 1x baseline → up to 3x on fresh kick
    const kickBoost = 1 + this.beatKickDecay * 2

    if (!musicData.isPlaying) {
      if (this.stopTime === 0) this.stopTime = now
      const decayFactor = Math.max(0, 1 - (now - this.stopTime) / 2000)
      for (let i = 0; i < 2048; i++) {
        this.frequencyData[i] = this.clamp255(this.frequencyData[i] * decayFactor * 0.95)
        this.timeDomainData[i] = 128
      }
      window.__musicData = { loudness: 0, pitches: [], timbre: [], beatPulse: 0, bassVal: 0 }
      return
    }

    this.stopTime = 0

    const segment = this.findCurrentSegment(timeSec)
    const bassMultiplier = this.settings.bassReactivity / 50
    const midMultiplier = this.settings.midReactivity / 50
    const highMultiplier = this.settings.highReactivity / 50

    // No segment (BPM fallback or analysis still loading): drive from beat pulse only
    if (!segment) {
      const bassVal = this.clamp255(80 * beatPulse * kickBoost * bassMultiplier)
      for (let i = 0; i <= 10; i++) this.frequencyData[i] = bassVal
      for (let i = 11; i < 1025; i++) this.frequencyData[i] = this.clamp255(this.frequencyData[i] * 0.95)
      // Brightness spike on kick
      const airVal = this.clamp255(kicked ? 200 * kickBoost : this.frequencyData[1025] * 0.95)
      for (let i = 1025; i < 2048; i++) this.frequencyData[i] = airVal
      for (let i = 0; i < 2048; i++) this.timeDomainData[i] = 128
      window.__musicData = { loudness: 0, pitches: [], timbre: [], beatPulse, bassVal }
      return
    }

    const pitches = segment.pitches || []
    const timbre = segment.timbre || []

    // Map loudness_max (-60 to 0 dB) → 0-1 — fed into Butterchurn every frame
    const loudnessNorm = Math.max(0, Math.min(1, (segment.loudness_max + 60) / 60))

    // Anticipation: ramp up in the last 30% of the interval before the next beat
    let anticipation = 0
    const analysis = getAnalysis()
    if (analysis && this.currentBeatIndex < analysis.beats.length - 1) {
      const nextBeatTime = analysis.beats[this.currentBeatIndex + 1].start
      const timeToNextBeat = nextBeatTime - timeSec
      const beatInterval = nextBeatTime - analysis.beats[this.currentBeatIndex].start
      if (beatInterval > 0 && timeToNextBeat > 0 && timeToNextBeat < beatInterval * 0.3) {
        anticipation = (1 - timeToNextBeat / (beatInterval * 0.3)) * 0.3
      }
    }

    // Bass (0-10): loudness * beatPulse, multiplied by kickBoost on beat
    const bassVal = this.clamp255(
      Math.max(20, loudnessNorm * 255 * (beatPulse + anticipation) + shimmer * 30) * bassMultiplier * kickBoost
    )
    for (let i = 0; i <= 10; i++) this.frequencyData[i] = bassVal

    // Low-mid (11-100): pitches[0,1,2]
    const lowMidVal = this.clamp255(
      Math.max(40, this.avg(pitches[0], pitches[1], pitches[2]) * 220 * (0.2 + 0.8 * (beatPulse + anticipation)) + shimmer * 20) * midMultiplier
    )
    for (let i = 11; i <= 100; i++) this.frequencyData[i] = lowMidVal

    // Mid (101-300): pitches[3,4,5]
    const midVal = this.clamp255(
      Math.max(40, this.avg(pitches[3], pitches[4], pitches[5]) * 200 + shimmer * 25) * midMultiplier
    )
    for (let i = 101; i <= 300; i++) this.frequencyData[i] = midVal

    // High-mid (301-600): pitches[6,7,8]
    const highMidVal = this.clamp255(
      Math.max(30, this.avg(pitches[6], pitches[7], pitches[8]) * 180 + shimmer * 20) * highMultiplier
    )
    for (let i = 301; i <= 600; i++) this.frequencyData[i] = highMidVal

    // High (601-1024): pitches[9,10,11]
    const highVal = this.clamp255(
      Math.max(30, this.avg(pitches[9], pitches[10], pitches[11]) * 160 + shimmer * 15) * highMultiplier
    )
    for (let i = 601; i <= 1024; i++) this.frequencyData[i] = highVal

    // Air/brightness (1025-2047): timbre[1] + beat kick brightness spike
    // timbre[1] is "brightness" coefficient — spiked by kickBoost on beat
    const timbre1 = timbre[1] !== undefined ? timbre[1] : 0
    const airVal = this.clamp255((Math.abs(timbre1) * 2 + shimmer * 10) * (1 + this.beatKickDecay * 1.5))
    for (let i = 1025; i < 2048; i++) this.frequencyData[i] = airVal

    // Time domain waveform
    for (let i = 0; i < 2048; i++) {
      const phase = (i / 2048) * Math.PI * 8 + timeSec * 10
      this.timeDomainData[i] = this.clamp255(128 + Math.sin(phase) * bassVal * 0.3)
    }

    window.__musicData = {
      loudness: loudnessNorm,
      pitches: pitches.slice(),
      timbre: timbre.slice(),
      beatPulse,
      bassVal,
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
