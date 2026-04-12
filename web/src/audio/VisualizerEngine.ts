// Butterchurn visualizer engine with synthetic audio reactivity
import butterchurn from 'butterchurn'
import butterchurnPresets from 'butterchurn-presets'

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

// Shared AudioContext singleton - created on first user gesture
let sharedAudioContext: AudioContext | null = null

export function getSharedAudioContext(): AudioContext | null {
  return sharedAudioContext
}

export function createSharedAudioContext(): AudioContext {
  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContext()
  }
  return sharedAudioContext
}

class VisualizerEngine {
  private canvas: HTMLCanvasElement | null = null
  private visualizer: ReturnType<typeof butterchurn.createVisualizer> | null = null
  private analyser: AnalyserNode | null = null
  private presets: Record<string, unknown> = {}
  private presetKeys: string[] = []
  private currentPresetIndex = 0
  private settings: VisualizerSettings = { ...DEFAULT_SETTINGS }
  private animationFrame: number | null = null
  private cycleInterval: ReturnType<typeof setInterval> | null = null

  // Synthetic audio for visualization
  private oscillator: OscillatorNode | null = null
  private gainNode: GainNode | null = null
  private lfo: OscillatorNode | null = null
  private lfoGain: GainNode | null = null
  private isPlaying = false
  private audioInitialized = false

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

    // Create a temporary offline audio context for Butterchurn initialization
    // Real audio will be connected via initializeAudio() on user gesture
    const offlineCtx = new OfflineAudioContext(2, 44100, 44100)

    this.visualizer = butterchurn.createVisualizer(offlineCtx as unknown as AudioContext, canvas, {
      width: canvas.width,
      height: canvas.height,
      meshWidth: 48,
      meshHeight: 36,
      pixelRatio: window.devicePixelRatio || 1,
    })

    // Load initial preset
    if (this.presetKeys.length > 0) {
      this.loadPreset(this.presetKeys[0])
    }

    // Start cycle timer
    this.startCycleTimer()

    // Start render loop
    this.startRenderLoop()
  }

  // Initialize audio system - must be called from a user gesture (click/touch)
  initializeAudio(): void {
    if (this.audioInitialized) return

    const ctx = createSharedAudioContext()

    // Create analyser for Butterchurn
    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 2048
    this.analyser.smoothingTimeConstant = 0.8

    // Create gain node for main output (silent - we just feed analyser)
    this.gainNode = ctx.createGain()
    this.gainNode.gain.value = 0 // Silent output

    // Create LFO for modulation (creates movement in visualization)
    this.lfoGain = ctx.createGain()
    this.lfoGain.gain.value = 30 // LFO depth in Hz

    this.lfo = ctx.createOscillator()
    this.lfo.type = 'sine'
    this.lfo.frequency.value = 0.5 // Slow modulation
    this.lfo.connect(this.lfoGain)
    this.lfo.start()

    // Create main oscillator (will be started/stopped with playback)
    this.oscillator = ctx.createOscillator()
    this.oscillator.type = 'sine'
    this.oscillator.frequency.value = 60 // Base frequency

    // Connect LFO to oscillator frequency for variation
    this.lfoGain.connect(this.oscillator.frequency)

    // Connect oscillator -> analyser -> gain (silent output)
    this.oscillator.connect(this.analyser)
    this.analyser.connect(this.gainNode)
    this.gainNode.connect(ctx.destination)

    // Connect analyser to Butterchurn
    if (this.visualizer) {
      this.visualizer.connectAudio(this.analyser)
    }

    this.audioInitialized = true
  }

  // Start synthetic audio (call when Spotify starts playing)
  startAudio(): void {
    if (!this.audioInitialized) {
      this.initializeAudio()
    }

    if (this.isPlaying) return

    const ctx = getSharedAudioContext()
    if (!ctx) return

    // Resume context if suspended
    if (ctx.state === 'suspended') {
      ctx.resume()
    }

    // Start oscillator
    if (this.oscillator) {
      try {
        this.oscillator.start()
      } catch {
        // Oscillator already started, recreate it
        this.recreateOscillator()
      }
    }

    this.isPlaying = true
  }

  // Stop synthetic audio (call when Spotify pauses)
  stopAudio(): void {
    if (!this.isPlaying) return

    if (this.oscillator) {
      try {
        this.oscillator.stop()
      } catch {
        // Oscillator not started
      }
      // Recreate oscillator for next play
      this.recreateOscillator()
    }

    this.isPlaying = false
  }

  // Update playback state - main interface for Spotify integration
  setPlaybackState(playing: boolean): void {
    if (playing) {
      this.startAudio()
    } else {
      this.stopAudio()
    }
  }

  private recreateOscillator(): void {
    const ctx = getSharedAudioContext()
    if (!ctx || !this.analyser || !this.lfoGain) return

    this.oscillator = ctx.createOscillator()
    this.oscillator.type = 'sine'
    this.oscillator.frequency.value = 60
    this.lfoGain.connect(this.oscillator.frequency)
    this.oscillator.connect(this.analyser)
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
    if (this.cycleInterval) {
      clearInterval(this.cycleInterval)
    }

    this.cycleInterval = setInterval(() => {
      this.nextPreset()
    }, this.settings.cycleSpeed * 1000)
  }

  private startRenderLoop(): void {
    const render = (_time: number) => {
      if (!this.visualizer) return

      // Render frame
      this.visualizer.render()

      this.animationFrame = requestAnimationFrame(render)
    }

    this.animationFrame = requestAnimationFrame(render)
  }

  getAudioContext(): AudioContext | null {
    return getSharedAudioContext()
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser
  }

  isAudioInitialized(): boolean {
    return this.audioInitialized
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

    // Stop oscillators
    try {
      this.oscillator?.stop()
      this.lfo?.stop()
    } catch {
      // Already stopped
    }

    this.oscillator = null
    this.lfo = null
    this.gainNode = null
    this.lfoGain = null
    this.analyser = null
    this.visualizer = null
    this.canvas = null
    this.audioInitialized = false
    this.isPlaying = false
  }
}

// Singleton instance
let engine: VisualizerEngine | null = null

export function getVisualizerEngine(): VisualizerEngine {
  if (!engine) {
    engine = new VisualizerEngine()
  }
  return engine
}

export function destroyVisualizerEngine(): void {
  if (engine) {
    engine.destroy()
    engine = null
  }
}
