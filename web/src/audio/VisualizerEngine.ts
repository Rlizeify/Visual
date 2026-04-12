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

// Mock AnalyserNode that Butterchurn will call each frame
interface MockAnalyser {
  frequencyBinCount: number
  getByteFrequencyData(arr: Uint8Array): void
  getByteTimeDomainData(arr: Uint8Array): void
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

  // Synthetic frequency/time domain arrays fed into Butterchurn
  private synthFreqData = new Uint8Array(1024)
  private synthTimeData = new Uint8Array(2048).fill(128)

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

    // Connect mock analyser — Butterchurn calls getByteFrequencyData/getByteTimeDomainData each frame
    const mockAnalyser: MockAnalyser = {
      frequencyBinCount: 1024,
      getByteFrequencyData: (arr: Uint8Array) => arr.set(this.synthFreqData),
      getByteTimeDomainData: (arr: Uint8Array) => arr.set(this.synthTimeData),
    }
    this.visualizer.connectAudio(mockAnalyser as unknown as AnalyserNode)

    if (this.presetKeys.length > 0) {
      this.loadPreset(this.presetKeys[0])
    }

    this.startCycleTimer()
    this.startRenderLoop()
  }

  // Call every frame with current Spotify music data
  updateMusicData(data: MusicData): void {
    const { energy, danceability, tempo, valence, progress, isPlaying } = data
    const rs = this.settings

    if (!isPlaying) {
      // Decay all values toward 0 smoothly
      for (let i = 0; i < 128; i++) {
        this.synthFreqData[i] = Math.max(0, this.synthFreqData[i] - 4)
      }
      return
    }

    // Beat pulse: sine wave driven by tempo (BPM) and progress_ms
    const beatsPerMs = tempo / 60000
    const beatPhase = (progress * beatsPerMs) * Math.PI * 2
    const pulse = (Math.sin(beatPhase) + 1) / 2 // 0-1

    const bassReact = rs.bassReactivity / 50
    const midReact = rs.midReactivity / 50
    const highReact = rs.highReactivity / 50

    // Bass (0-10): energy driven
    const bassVal = Math.min(255, energy * 255 * bassReact * (0.7 + 0.3 * pulse))
    for (let i = 0; i < 10; i++) {
      this.synthFreqData[i] = Math.round(bassVal)
    }

    // Mid (10-50): danceability driven
    const midVal = Math.min(255, danceability * 200 * midReact * (0.8 + 0.2 * pulse))
    for (let i = 10; i < 50; i++) {
      this.synthFreqData[i] = Math.round(midVal)
    }

    // High (50-128): valence driven
    const highVal = Math.min(255, valence * 180 * highReact * (0.9 + 0.1 * pulse))
    for (let i = 50; i < 128; i++) {
      this.synthFreqData[i] = Math.round(highVal)
    }

    // Time domain: gentle variation around midpoint
    const tdAmp = energy * 20
    for (let i = 0; i < 2048; i++) {
      this.synthTimeData[i] = Math.round(128 + Math.sin(i * 0.02 + beatPhase) * tdAmp)
    }
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
