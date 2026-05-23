// Butterchurn visualizer engine.
// Holds the canvas + Butterchurn instance + a LiveAudioRouter that owns the
// shared AnalyserNode. Butterchurn, the signal meter, and the T3 waveform
// sampler all read from the same analyser.

import butterchurn from 'butterchurn'
import butterchurnPresets from 'butterchurn-presets'
import { LiveAudioRouter } from './liveAudioRouter'
import { listAudioInputDevices } from './liveAudioCapture'

export interface VisualizerSettings {
  animationSpeed: number
  blendTime: number
  cycleSpeed: number
}

const DEFAULT_SETTINGS: VisualizerSettings = {
  animationSpeed: 1, blendTime: 2.5, cycleSpeed: 15,
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
  private audioContext: AudioContext | null = null
  private router: LiveAudioRouter | null = null

  constructor() {
    this.presets = butterchurnPresets.getPresets()
    this.presetKeys = Object.keys(this.presets)
  }

  getPresetKeys(): string[] { return this.presetKeys }
  getCurrentPreset(): string { return this.presetKeys[this.currentPresetIndex] || '' }
  getSettings(): VisualizerSettings { return { ...this.settings } }
  getSharedAnalyser(): AnalyserNode | null { return this.router?.analyser ?? null }
  isLiveAudioEnabled(): boolean { return this.router?.isEnabled() ?? false }
  getLiveDeviceLabel(): string { return this.router?.getLabel() ?? '' }
  getCurrentSignalLevel(): number { return this.router?.getSignalLevel() ?? 0 }
  enableLiveAudio = (deviceId?: string) =>
    this.requireRouter().enableMic(deviceId)
  enableTabAudio = () => this.requireRouter().enableTab()
  disableLiveAudio = () => this.router?.disable()
  listAudioInputDevices = listAudioInputDevices

  initialize(canvas: HTMLCanvasElement): void {
    // Probe WebGL up front — a hidden / 0x0 canvas yields a null context
    // and Butterchurn crashes deep in createFramebuffer otherwise.
    const probe =
      (canvas.getContext('webgl2') as WebGLRenderingContext | null) ||
      (canvas.getContext('webgl') as WebGLRenderingContext | null)
    if (!probe) throw new Error('[VisualizerEngine] WebGL context unavailable')

    this.canvas = canvas
    this.audioContext = new AudioContext()
    this.router = new LiveAudioRouter(this.audioContext)

    this.visualizer = butterchurn.createVisualizer(this.audioContext, canvas, {
      width: canvas.width, height: canvas.height,
      meshWidth: 48, meshHeight: 36,
      pixelRatio: window.devicePixelRatio || 1,
    })
    this.visualizer.connectAudio(this.router.analyser)

    if (this.presetKeys.length > 0) this.loadPreset(this.presetKeys[0])
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
    this.visualizer.loadPreset(this.presets[presetName], blendTime ?? this.settings.blendTime)
    this.currentPresetIndex = this.presetKeys.indexOf(presetName)
  }

  nextPreset(): void {
    this.currentPresetIndex = (this.currentPresetIndex + 1) % this.presetKeys.length
    this.loadPreset(this.presetKeys[this.currentPresetIndex])
  }

  updateSettings(patch: Partial<VisualizerSettings>): void {
    this.settings = { ...this.settings, ...patch }
    if ('cycleSpeed' in patch) this.startCycleTimer()
  }

  destroy(): void {
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame)
    if (this.cycleInterval) clearInterval(this.cycleInterval)
    this.animationFrame = null
    this.cycleInterval = null
    this.router?.disable()
    this.router = null
    if (this.audioContext) { this.audioContext.close(); this.audioContext = null }
    this.visualizer = null
    this.canvas = null
  }

  private requireRouter(): LiveAudioRouter {
    if (!this.router) throw new Error('VisualizerEngine not initialized')
    return this.router
  }

  private startCycleTimer(): void {
    if (this.cycleInterval) clearInterval(this.cycleInterval)
    this.cycleInterval = setInterval(() => this.nextPreset(), this.settings.cycleSpeed * 1000)
  }

  private startRenderLoop(): void {
    const render = () => {
      if (!this.visualizer) return
      this.visualizer.render()
      this.animationFrame = requestAnimationFrame(render)
    }
    this.animationFrame = requestAnimationFrame(render)
  }
}

let engine: VisualizerEngine | null = null
export function getVisualizerEngine(): VisualizerEngine {
  if (!engine) engine = new VisualizerEngine()
  return engine
}
export function destroyVisualizerEngine(): void {
  if (engine) { engine.destroy(); engine = null }
}
