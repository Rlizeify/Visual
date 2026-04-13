// Butterchurn visualizer engine consuming Spotify audio analysis data
import butterchurn from 'butterchurn'
import butterchurnPresets from 'butterchurn-presets'
import { getFrequencyData } from './SpotifyWebPlayer'

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
  private presets: Record<string, unknown> = {}
  private presetKeys: string[] = []
  private currentPresetIndex = 0
  private settings: VisualizerSettings = { ...DEFAULT_SETTINGS }
  private animationFrame: number | null = null
  private cycleInterval: ReturnType<typeof setInterval> | null = null
  private lastLogTime = 0

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

    const offlineCtx = new OfflineAudioContext(2, 44100, 44100)
    this.visualizer = butterchurn.createVisualizer(offlineCtx as unknown as AudioContext, canvas, {
      width: canvas.width,
      height: canvas.height,
      meshWidth: 48,
      meshHeight: 36,
      pixelRatio: window.devicePixelRatio || 1,
    })

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

  private startRenderLoop(): void {
    const render = () => {
      if (!this.visualizer) return

      // Get frequency data from SpotifyWebPlayer (already generated each frame there)
      const frequencyData = getFrequencyData()

      // Log once per second for debugging
      const now = performance.now()
      if (now - this.lastLogTime >= 1000) {
        const first5 = Array.from(frequencyData.slice(0, 5))
        console.log('[Visualizer] Frequency[0..4]:', first5.join(', '))
        this.lastLogTime = now
      }

      // Inject into Butterchurn's internal renderer
      const renderer = (this.visualizer as unknown as { renderer?: { audio?: {
        timeByteTimeDomainData?: Uint8Array
        frequencyByteFrequencyData?: Uint8Array
      }}}).renderer

      if (renderer?.audio) {
        // Apply reactivity settings
        const modifiedData = new Uint8Array(frequencyData.length)
        for (let i = 0; i < frequencyData.length; i++) {
          let multiplier = 1
          if (i < 51) {
            multiplier = this.settings.bassReactivity / 50
          } else if (i < 513) {
            multiplier = this.settings.midReactivity / 50
          } else {
            multiplier = this.settings.highReactivity / 50
          }
          modifiedData[i] = Math.min(255, Math.floor(frequencyData[i] * multiplier))
        }

        if (renderer.audio.frequencyByteFrequencyData) {
          renderer.audio.frequencyByteFrequencyData.set(modifiedData.slice(0, renderer.audio.frequencyByteFrequencyData.length))
        }
        if (renderer.audio.timeByteTimeDomainData) {
          // Use lower frequencies for waveform (time domain)
          renderer.audio.timeByteTimeDomainData.set(modifiedData.slice(0, renderer.audio.timeByteTimeDomainData.length))
        }
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
