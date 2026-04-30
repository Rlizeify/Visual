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
  cycleSpeed: 15,
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
  private frequencyData = new Uint8Array(2048)
  private timeDomainData = new Uint8Array(2048)

  // Live audio capture (system audio via BlackHole/loopback or any input device)
  private liveStream: MediaStream | null = null
  private liveSource: MediaStreamAudioSourceNode | null = null
  private liveAnalyser: AnalyserNode | null = null
  private liveAudioEnabled = false
  private liveDeviceLabel = ''

  // Beat tracking
  private currentBeatIndex = 0
  private lastBeatTime = 0
  private lastKickedBeatIndex = -1 // avoids double-firing kick for same beat
  private beatKickFrames = 0        // frames remaining for kick spike (+30 for 2 frames)
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

  isLiveAudioEnabled(): boolean {
    return this.liveAudioEnabled
  }

  getLiveDeviceLabel(): string {
    return this.liveDeviceLabel
  }

  async listAudioInputDevices(): Promise<MediaDeviceInfo[]> {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter(d => d.kind === 'audioinput')
  }

  async enableLiveAudio(deviceId?: string): Promise<{ deviceId: string; label: string }> {
    if (!this.audioContext) throw new Error('VisualizerEngine not initialized')
    if (this.audioContext.state === 'suspended') await this.audioContext.resume()

    this.disableLiveAudio()

    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    }
    if (deviceId) audioConstraints.deviceId = { exact: deviceId }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints })
    const track = stream.getAudioTracks()[0]
    const settings = track?.getSettings() || {}
    let resolvedId = (settings.deviceId as string) || deviceId || ''
    let resolvedLabel = track?.label || ''

    // If no deviceId was provided, auto-detect BlackHole and switch to it
    if (!deviceId) {
      const all = await navigator.mediaDevices.enumerateDevices()
      const inputs = all.filter(d => d.kind === 'audioinput')
      const blackhole = inputs.find(d => /blackhole/i.test(d.label))
      if (blackhole && blackhole.deviceId !== resolvedId) {
        for (const t of stream.getTracks()) t.stop()
        const stream2 = await navigator.mediaDevices.getUserMedia({
          audio: { ...audioConstraints, deviceId: { exact: blackhole.deviceId } },
        })
        const track2 = stream2.getAudioTracks()[0]
        const s2 = track2?.getSettings() || {}
        resolvedId = (s2.deviceId as string) || blackhole.deviceId
        resolvedLabel = track2?.label || blackhole.label
        this.liveStream = stream2
      } else {
        this.liveStream = stream
      }
    } else {
      this.liveStream = stream
    }

    this.liveSource = this.audioContext.createMediaStreamSource(this.liveStream!)
    this.liveAnalyser = this.audioContext.createAnalyser()
    this.liveAnalyser.fftSize = 4096
    this.liveAnalyser.smoothingTimeConstant = 0.65
    this.liveSource.connect(this.liveAnalyser)
    // Note: do NOT connect to destination — we only want to analyse, not play back

    this.liveAudioEnabled = true
    this.liveDeviceLabel = resolvedLabel
    return { deviceId: resolvedId, label: resolvedLabel }
  }

  disableLiveAudio(): void {
    if (this.liveSource) {
      try { this.liveSource.disconnect() } catch { /* noop */ }
    }
    if (this.liveStream) {
      for (const t of this.liveStream.getTracks()) t.stop()
    }
    this.liveStream = null
    this.liveSource = null
    this.liveAnalyser = null
    this.liveAudioEnabled = false
    this.liveDeviceLabel = ''
  }

  private startCycleTimer(): void {
    if (this.cycleInterval) clearInterval(this.cycleInterval)
    this.cycleInterval = setInterval(() => {
      this.nextPreset()
    }, this.settings.cycleSpeed * 1000)
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

  // Live path: read real FFT/waveform from the input stream and apply reactivity multipliers
  private updateLiveMusicData(): void {
    if (!this.liveAnalyser) return
    this.liveAnalyser.getByteFrequencyData(this.frequencyData)
    this.liveAnalyser.getByteTimeDomainData(this.timeDomainData)

    const bassMul = this.settings.bassReactivity / 50
    const midMul = this.settings.midReactivity / 50
    const highMul = this.settings.highReactivity / 50
    const len = this.frequencyData.length
    let bassSum = 0
    for (let i = 0; i < len; i++) {
      let mul: number
      if (i < 8)        mul = bassMul
      else if (i < 64)  mul = midMul
      else              mul = highMul
      const v = this.frequencyData[i] * mul
      this.frequencyData[i] = v < 0 ? 0 : v > 255 ? 255 : v
      if (i < 8) bassSum += this.frequencyData[i]
    }
    const bassVal = bassSum / 8
    window.__musicData = {
      loudness: bassVal / 255,
      pitches: [],
      timbre: [],
      beatPulse: bassVal / 255,
      bassVal,
    }
  }

  // Update synthetic audio data every animation frame.
  // Shapes frequency bins using beat position (timeSinceBeat) so Butterchurn reacts
  // continuously — independent of Spotify poll cadence.
  private updateMusicData(): void {
    if (this.liveAudioEnabled) {
      this.updateLiveMusicData()
      return
    }

    const musicData = getMusicData()
    const currentPositionMs = getInterpolatedProgress()
    const now = Date.now()
    const timeSec = currentPositionMs / 1000

    // Beat scheduler runs every frame — fires kick event when we enter beat window
    const { kicked } = this.runBeatScheduler(timeSec)
    if (kicked) this.beatKickFrames = 2

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

    // Tempo: use real analysis track tempo when available, else BPM fallback
    const analysis = getAnalysis()
    const tempo = (analysis?.track.tempo ?? musicData.tempo) || 120
    const beatIntervalMs = 60000 / tempo

    // Beat position within current interval: 0 at beat start, approaches 1 before next beat
    const timeSinceBeat = (currentPositionMs % beatIntervalMs) / beatIntervalMs
    // Sharp attack, cubic decay: 1.0 right on beat, 0.0 at next beat
    const beatCurve = Math.pow(1 - timeSinceBeat, 3)

    // Reactivity multipliers from settings panel
    const bassMultiplier = this.settings.bassReactivity / 50
    const midMultiplier = this.settings.midReactivity / 50
    const highMultiplier = this.settings.highReactivity / 50

    // Beat kick spike: all bins +30 for 2 frames
    const kickSpike = this.beatKickFrames > 0 ? 30 : 0
    if (this.beatKickFrames > 0) this.beatKickFrames--

    // Band base values shaped by beat curve
    const bassValue = 180 + (beatCurve * 75)   // peaks 255 on beat, floor 180
    const midValue  = 120 + (beatCurve * 60)   // softer mid response
    const highBase  = 60  + (beatCurve * 40)   // shimmer added per high bin

    for (let i = 0; i < 2048; i++) {
      let value: number
      if (i <= 2) {
        // Bass bins [0..2]: sharp beat attack
        value = (bassValue + kickSpike) * bassMultiplier
      } else if (i <= 6) {
        // Mid bins [3..6]: softer response
        value = (midValue + kickSpike) * midMultiplier
      } else if (i <= 15) {
        // High bins [7..15]: shimmer via per-bin noise
        value = (highBase + (Math.random() * 20) + kickSpike) * highMultiplier
      } else {
        // All other bins: interpolate between bass and high values across the spectrum
        const t = (i - 16) / (2047 - 16)
        value = bassValue * (1 - t) + highBase * t + kickSpike
      }
      this.frequencyData[i] = this.clamp255(value)
    }

    // Time domain waveform modulated by beat
    for (let i = 0; i < 2048; i++) {
      const phase = (i / 2048) * Math.PI * 8 + timeSec * 10
      this.timeDomainData[i] = this.clamp255(128 + Math.sin(phase) * bassValue * 0.3)
    }

    window.__musicData = {
      loudness: beatCurve,
      pitches: [],
      timbre: [],
      beatPulse: beatCurve,
      bassVal: this.clamp255(bassValue),
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
        const slice16 = Array.from(this.frequencyData.slice(0, 16))
        const freqMin = Math.min(...slice16)
        const freqMax = Math.max(...slice16)
        console.log(`[VisualizerEngine] Freq[0..15] range: ${freqMin}–${freqMax}`)
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
    this.disableLiveAudio()
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
