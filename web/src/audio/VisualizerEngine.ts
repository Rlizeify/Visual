// Butterchurn visualizer engine with music-data-driven synthetic audio
import butterchurn from 'butterchurn'
import butterchurnPresets from 'butterchurn-presets'
import type { MusicData } from './SpotifyWebPlayer'

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

    // No connectAudio call — Butterchurn renders preset animations without audio reactivity
    // Presets have built-in motion; audio data polling drives UI state separately

    if (this.presetKeys.length > 0) {
      this.loadPreset(this.presetKeys[0])
    }

    this.startCycleTimer()
    this.startRenderLoop()
  }

  // No-op: audio reactivity removed (connectAudio was causing errors)
  // Butterchurn renders preset animations autonomously without audio input
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  updateMusicData(_data: MusicData): void {
    // Retained for API compatibility; does nothing now
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
