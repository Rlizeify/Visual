// Butterchurn visualizer engine with Web Audio integration
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

class VisualizerEngine {
  private canvas: HTMLCanvasElement | null = null
  private visualizer: ReturnType<typeof butterchurn.createVisualizer> | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private presets: Record<string, unknown> = {}
  private presetKeys: string[] = []
  private currentPresetIndex = 0
  private settings: VisualizerSettings = { ...DEFAULT_SETTINGS }
  private animationFrame: number | null = null
  private cycleInterval: ReturnType<typeof setInterval> | null = null

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

  // Must be called from a user gesture (click/touch)
  initializeAudio(): AudioContext {
    if (this.audioContext) {
      return this.audioContext
    }

    this.audioContext = new AudioContext()
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 2048
    this.analyser.smoothingTimeConstant = 0.8

    if (this.visualizer) {
      this.visualizer.connectAudio(this.analyser)
    }

    return this.audioContext
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
    return this.audioContext
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser
  }

  // Connect an external audio source to the analyser
  connectSource(source: MediaStreamAudioSourceNode | MediaElementAudioSourceNode): void {
    if (this.analyser) {
      source.connect(this.analyser)
    }
  }

  // Capture tab audio via getDisplayMedia and connect to visualizer
  async captureTabAudio(): Promise<boolean> {
    try {
      // Ensure audio context is initialized
      this.initializeAudio()

      // Request tab audio capture
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true, // Required but we won't use it
        audio: true,
      })

      // Stop video track immediately - we only need audio
      stream.getVideoTracks().forEach(track => track.stop())

      const audioTracks = stream.getAudioTracks()
      if (audioTracks.length === 0) {
        console.error('No audio track captured. Make sure to select "Share tab audio".')
        return false
      }

      // Create audio source from the captured stream
      const audioStream = new MediaStream(audioTracks)
      const source = this.audioContext!.createMediaStreamSource(audioStream)
      this.connectSource(source)

      return true
    } catch (err) {
      console.error('Failed to capture tab audio:', err)
      return false
    }
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

    this.visualizer = null
    this.analyser = null
    this.canvas = null
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
