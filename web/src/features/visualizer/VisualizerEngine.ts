// Butterchurn visualizer engine.
// Holds the canvas + Butterchurn instance + a LiveAudioRouter that owns the
// shared AnalyserNode. Butterchurn, the signal meter, and the T3 waveform
// sampler all read from the same analyser.
//
// Preset library: merged from the 5 sub-packs that ship with
// butterchurn-presets (main + extra + extra2 + MD1 + nonMinimal).
// Main wins on collision so curated names stay stable.
//
// Auto-shuffle: cycleSpeed > 0 enables random advance with a 5-deep
// "recently-played" history so the same preset doesn't repeat too soon.
// cycleSpeed = 0 disables auto-shuffle entirely. Manual loadPreset()
// resets the silence tracker and restarts the cycle countdown.
//
// Audio gating: a 500ms poll refreshes lastNonSilentMs whenever audio is
// present — either the shared analyser is above SILENCE_THRESHOLD (live
// system/tab capture) OR Spotify reports active playback. If neither has
// been true for SILENCE_GATE_MS continuously, the next cycle tick is
// skipped — no preset churn during silent moments. The Spotify-playback
// fallback matters because the analyser only carries signal when the user
// has explicitly enabled live capture; without it the gate would treat the
// common Spotify-only session as permanently silent and never shuffle.

import butterchurn from 'butterchurn'
import butterchurnPresets from 'butterchurn-presets'
import butterchurnPresetsExtra from 'butterchurn-presets/lib/butterchurnPresetsExtra.min.js'
import butterchurnPresetsExtra2 from 'butterchurn-presets/lib/butterchurnPresetsExtra2.min.js'
import butterchurnPresetsMD1 from 'butterchurn-presets/lib/butterchurnPresetsMD1.min.js'
import butterchurnPresetsNonMinimal from 'butterchurn-presets/lib/butterchurnPresetsNonMinimal.min.js'
import { LiveAudioRouter } from './liveAudioRouter'
import { listAudioInputDevices } from './liveAudioCapture'
import { getMusicData } from '../../services/spotify/polling'

export interface VisualizerSettings {
  animationSpeed: number
  blendTime: number
  cycleSpeed: number   // 0 = auto-shuffle OFF; otherwise seconds between advances
}

const DEFAULT_SETTINGS: VisualizerSettings = {
  animationSpeed: 1, blendTime: 2.5, cycleSpeed: 45,
}

const SHUFFLE_HISTORY_SIZE = 5
const SILENCE_THRESHOLD = 0.005
const SILENCE_GATE_MS = 10_000
const SIGNAL_POLL_MS = 500

function mergePresets(): Record<string, unknown> {
  // Main wins on duplicate name so curated entries stay stable.
  // Spread order: rightmost wins, so put `main` last.
  return {
    ...butterchurnPresetsNonMinimal.getPresets(),
    ...butterchurnPresetsMD1.getPresets(),
    ...butterchurnPresetsExtra2.getPresets(),
    ...butterchurnPresetsExtra.getPresets(),
    ...butterchurnPresets.getPresets(),
  }
}

class VisualizerEngine {
  private canvas: HTMLCanvasElement | null = null
  private visualizer: ReturnType<typeof butterchurn.createVisualizer> | null = null
  private presets: Record<string, unknown> = {}
  private presetKeys: string[] = []
  private currentPresetIndex = 0
  private recentlyPlayed: number[] = []
  private settings: VisualizerSettings = { ...DEFAULT_SETTINGS }
  private animationFrame: number | null = null
  private cycleInterval: ReturnType<typeof setInterval> | null = null
  private signalInterval: ReturnType<typeof setInterval> | null = null
  private lastNonSilentMs: number = Date.now()
  private audioContext: AudioContext | null = null
  private router: LiveAudioRouter | null = null

  constructor() {
    this.presets = mergePresets()
    this.presetKeys = Object.keys(this.presets)
  }

  getPresetKeys(): string[] { return this.presetKeys }
  getPresetCount(): number { return this.presetKeys.length }
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

    if (this.presetKeys.length > 0) this.loadPresetByIndex(0)
    this.startSignalPoll()
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
    const index = this.presetKeys.indexOf(presetName)
    if (index < 0) return
    this.visualizer.loadPreset(this.presets[presetName], blendTime ?? this.settings.blendTime)
    this.currentPresetIndex = index
    this.pushHistory(index)
    // Manual advance resets the silence tracker and the cycle clock.
    this.lastNonSilentMs = Date.now()
    this.startCycleTimer()
  }

  // Random pick from the library that isn't the current preset and
  // isn't in the recently-played ring. Falls back gracefully if the
  // history covers most of the library.
  nextPreset(): void {
    if (this.presetKeys.length === 0) return
    if (this.presetKeys.length === 1) {
      this.loadPresetByIndex(0)
      return
    }
    const exclude = new Set([this.currentPresetIndex, ...this.recentlyPlayed])
    const pool: number[] = []
    for (let i = 0; i < this.presetKeys.length; i++) {
      if (!exclude.has(i)) pool.push(i)
    }
    // If the exclusion left nothing (tiny library or huge history), drop
    // the oldest from history and try again.
    const target = pool.length > 0
      ? pool[Math.floor(Math.random() * pool.length)]
      : (this.currentPresetIndex + 1) % this.presetKeys.length
    this.loadPresetByIndex(target)
  }

  updateSettings(patch: Partial<VisualizerSettings>): void {
    this.settings = { ...this.settings, ...patch }
    if ('cycleSpeed' in patch) this.startCycleTimer()
  }

  destroy(): void {
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame)
    if (this.cycleInterval) clearInterval(this.cycleInterval)
    if (this.signalInterval) clearInterval(this.signalInterval)
    this.animationFrame = null
    this.cycleInterval = null
    this.signalInterval = null
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

  private loadPresetByIndex(index: number, blendTime?: number): void {
    if (!this.visualizer) return
    if (index < 0 || index >= this.presetKeys.length) return
    const name = this.presetKeys[index]
    this.visualizer.loadPreset(this.presets[name], blendTime ?? this.settings.blendTime)
    this.currentPresetIndex = index
    this.pushHistory(index)
  }

  private pushHistory(index: number): void {
    this.recentlyPlayed.push(index)
    while (this.recentlyPlayed.length > SHUFFLE_HISTORY_SIZE) {
      this.recentlyPlayed.shift()
    }
  }

  private startCycleTimer(): void {
    if (this.cycleInterval) {
      clearInterval(this.cycleInterval)
      this.cycleInterval = null
    }
    const seconds = this.settings.cycleSpeed
    if (!seconds || seconds <= 0) return // auto-shuffle off
    this.cycleInterval = setInterval(() => {
      // Skip the advance if audio has been silent past the gate.
      if (Date.now() - this.lastNonSilentMs > SILENCE_GATE_MS) return
      this.nextPreset()
    }, seconds * 1000)
  }

  private startSignalPoll(): void {
    if (this.signalInterval) clearInterval(this.signalInterval)
    this.signalInterval = setInterval(() => {
      // Audio counts as "present" if EITHER the shared analyser shows live
      // signal (system/tab capture is on) OR Spotify reports active playback.
      // The analyser is silent unless the user has enabled live capture, so
      // gating on it alone froze the shuffle for the common Spotify-only case
      // (analyser reads pure silence -> lastNonSilentMs never refreshes ->
      // the 10s gate stays shut forever). The isPlaying fallback keeps the
      // gate honest: a paused/stopped track with no live signal still goes
      // silent after SILENCE_GATE_MS and pauses the shuffle as intended.
      const level = this.getCurrentSignalLevel()
      if (level > SILENCE_THRESHOLD || getMusicData().isPlaying) {
        this.lastNonSilentMs = Date.now()
      }
    }, SIGNAL_POLL_MS)
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
