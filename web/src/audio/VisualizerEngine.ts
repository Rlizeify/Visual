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

  // Synthetic audio data for music reactivity
  private syntheticFrequencyData: Float32Array = new Float32Array(512)
  private currentMusicData: MusicData = {
    isPlaying: false,
    trackId: null,
    trackName: '',
    artistName: '',
    albumArt: '',
    progress: 0,
    duration: 0,
    energy: 0.5,
    danceability: 0.5,
    tempo: 120,
    valence: 0.5,
    shuffleState: false,
  }
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

    // No connectAudio call — Butterchurn renders preset animations without audio reactivity
    // Presets have built-in motion; audio data polling drives UI state separately

    if (this.presetKeys.length > 0) {
      this.loadPreset(this.presetKeys[0])
    }

    this.startCycleTimer()
    this.startRenderLoop()
  }

  // Update music data from Spotify polling
  updateMusicData(data: MusicData): void {
    this.currentMusicData = data
    // Note: logging happens in render loop (once per second) to avoid console flood
  }

  // Generate synthetic audio data based on energy, tempo, danceability
  private generateSyntheticAudio(): void {
    const { energy, tempo, danceability, isPlaying } = this.currentMusicData
    const time = performance.now() / 1000 // seconds

    // Tempo-based oscillation rate (beats per second)
    const beatRate = tempo / 60

    for (let i = 0; i < 512; i++) {
      // Frequency bands: bass (0-85), mid (86-255), high (256-511)
      let amplitude = 0

      if (isPlaying) {
        // Bass frequencies - energy driven with beat pulsing
        if (i < 86) {
          const bassBeat = Math.sin(time * beatRate * Math.PI * 2) * 0.5 + 0.5
          amplitude = energy * 0.8 + bassBeat * energy * 0.2
          amplitude *= (this.settings.bassReactivity / 50)
        }
        // Mid frequencies - danceability driven
        else if (i < 256) {
          const midWave = Math.sin(time * beatRate * 0.5 * Math.PI * 2 + i * 0.1) * 0.3 + 0.7
          amplitude = danceability * midWave * 0.7
          amplitude *= (this.settings.midReactivity / 50)
        }
        // High frequencies - valence/energy mix
        else {
          const highWave = Math.sin(time * beatRate * 2 * Math.PI * 2 + i * 0.05) * 0.4 + 0.6
          amplitude = (energy * 0.5 + this.currentMusicData.valence * 0.5) * highWave * 0.5
          amplitude *= (this.settings.highReactivity / 50)
        }
      }

      // Store as dB-like value (-1 to 0 range for Butterchurn)
      this.syntheticFrequencyData[i] = amplitude > 0 ? -1 + amplitude : -1
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

      // Regenerate synthetic audio each frame for smooth animation
      this.generateSyntheticAudio()

      // Log music data and first 5 frequency values once per second
      const now = performance.now()
      if (now - this.lastLogTime >= 1000) {
        const first5 = Array.from(this.syntheticFrequencyData.slice(0, 5)).map(v => v.toFixed(3))
        console.log('[VisualizerEngine] MusicData:', {
          energy: this.currentMusicData.energy,
          tempo: this.currentMusicData.tempo,
          isPlaying: this.currentMusicData.isPlaying,
        })
        console.log('[VisualizerEngine] Frequency[0..4]:', first5.join(', '))
        this.lastLogTime = now
      }

      // Inject synthetic audio data into Butterchurn's internal renderer
      const renderer = (this.visualizer as unknown as { renderer?: { audio?: {
        timeByteTimeDomainData?: Uint8Array
        frequencyByteFrequencyData?: Uint8Array
      }}}).renderer
      if (renderer?.audio) {
        // Convert Float32 (-1 to 0) to Uint8 (0 to 255) for Butterchurn
        const uint8Data = new Uint8Array(512)
        for (let i = 0; i < 512; i++) {
          uint8Data[i] = Math.floor((this.syntheticFrequencyData[i] + 1) * 127.5)
        }
        if (renderer.audio.frequencyByteFrequencyData) {
          renderer.audio.frequencyByteFrequencyData.set(uint8Data)
        }
        if (renderer.audio.timeByteTimeDomainData) {
          renderer.audio.timeByteTimeDomainData.set(uint8Data)
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
