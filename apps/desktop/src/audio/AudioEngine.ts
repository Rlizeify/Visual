import * as Tone from 'tone'
import { PluginChain } from '../plugins/PluginChain'
import { Compressor } from '../plugins/effects/Compressor'
import { EQ } from '../plugins/effects/EQ'
import { Delay } from '../plugins/effects/Delay'

class AudioEngine {
  private player: Tone.Player
  private bassBoostFilter: Tone.Filter
  private lowShelf: Tone.Filter
  private highShelf: Tone.Filter
  private reverb: Tone.Reverb
  private chorus: Tone.Chorus
  private analysisNode: GainNode
  private analyser: AnalyserNode
  private splitter: ChannelSplitterNode | null = null
  private leftAnalyser: AnalyserNode | null = null
  private rightAnalyser: AnalyserNode | null = null
  private pluginChain!: PluginChain

  private _isLoaded = false
  private _isPlaying = false
  private _filename = ''
  private _duration = 0
  private startedAt = 0
  private pauseOffset = 0
  private timeUpdateId: ReturnType<typeof setInterval> | null = null

  // Vinyl sim state
  private vinylIntervalId: ReturnType<typeof setInterval> | null = null
  private vinylPhase = 0
  private _currentSpeedPercent = 100

  constructor() {
    this.player = new Tone.Player()
    this.player.loop = false

    // Effects chain nodes
    this.bassBoostFilter = new Tone.Filter({ type: 'lowshelf', frequency: 80, gain: 0 })
    this.lowShelf = new Tone.Filter({ type: 'lowshelf', frequency: 320, gain: 0 })
    this.highShelf = new Tone.Filter({ type: 'highshelf', frequency: 3200, gain: 0 })
    this.reverb = new Tone.Reverb({ decay: 1.5, wet: 0 })
    this.chorus = new Tone.Chorus({ frequency: 0.5, delayTime: 2.5, depth: 0.5, wet: 0 })

    // Player → BassBoost → LowShelf → HighShelf → Reverb → Chorus → Destination
    this.player.chain(
      this.bassBoostFilter,
      this.lowShelf,
      this.highShelf,
      this.reverb,
      this.chorus,
      Tone.getDestination(),
    )

    // Analysis tap — fan-out from player to a native GainNode for BeatDetector
    const ctx = Tone.getContext().rawContext as AudioContext
    this.analysisNode = ctx.createGain()
    this.analysisNode.gain.value = 1
    this.player.connect(this.analysisNode as unknown as Tone.ToneAudioNode)

    // Master analyser for oscilloscope
    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 2048
    this.analysisNode.connect(this.analyser)

    // Stereo splitter for L/R channel data
    try {
      this.splitter = ctx.createChannelSplitter(2)
      this.leftAnalyser = ctx.createAnalyser()
      this.leftAnalyser.fftSize = 2048
      this.rightAnalyser = ctx.createAnalyser()
      this.rightAnalyser.fftSize = 2048
      this.analysisNode.connect(this.splitter)
      this.splitter.connect(this.leftAnalyser, 0)
      this.splitter.connect(this.rightAnalyser, 1)
    } catch {
      this.splitter = null
      this.leftAnalyser = null
      this.rightAnalyser = null
    }

    // ── Plugin chain — inserted between chorus and AudioContext destination ──
    // Disconnect chorus from Tone's master output, bridge through plugin chain.
    const pluginBridgeIn = ctx.createGain()
    this.chorus.disconnect()
    // Tone.ToneAudioNode.connect() accepts raw AudioNode at runtime.
    this.chorus.connect(pluginBridgeIn as unknown as Tone.ToneAudioNode)

    this.pluginChain = new PluginChain(ctx)
    this.pluginChain.connectSource(pluginBridgeIn)
    this.pluginChain.connectDestination(ctx.destination)
    this.pluginChain.addPlugin(new Compressor(ctx))
    this.pluginChain.addPlugin(new EQ(ctx))
    this.pluginChain.addPlugin(new Delay(ctx))
  }

  // ── Expose internals for BeatDetector ──────────────────────────────────────

  getAudioContext(): AudioContext {
    return Tone.getContext().rawContext as AudioContext
  }

  getSourceNode(): GainNode {
    return this.analysisNode
  }

  getPluginChain(): PluginChain {
    return this.pluginChain
  }

  // ── Transport ──────────────────────────────────────────────────────────────

  async load(filepath: string) {
    if (this._isPlaying) this.stop()

    const data = await window.api?.readAudioFile(filepath)
    if (!data) throw new Error('Failed to read audio file')

    const blob = new Blob([new Uint8Array(data)], { type: 'audio/mpeg' })
    const url = URL.createObjectURL(blob)

    try {
      await this.player.load(url)
    } finally {
      URL.revokeObjectURL(url)
    }

    this._isLoaded = true
    this._duration = this.player.buffer.duration
    this._filename = filepath.split(/[\\/]/).pop() ?? filepath
    this.pauseOffset = 0

    this.emit('audio:loaded', { filename: this._filename, duration: this._duration })
  }

  async play() {
    if (!this._isLoaded || this._isPlaying) return
    await Tone.start()

    this.player.start(undefined, this.pauseOffset)
    this.startedAt = Tone.now()
    this._isPlaying = true

    this.startTimeUpdate()
    this.emit('audio:playing')
  }

  pause() {
    if (!this._isPlaying) return
    this.pauseOffset = this.getCurrentTime()
    this.player.stop()
    this._isPlaying = false

    this.stopTimeUpdate()
    this.emit('audio:paused')
  }

  stop() {
    this.player.stop()
    this.pauseOffset = 0
    this._isPlaying = false

    this.stopTimeUpdate()
    this.emit('audio:stopped')
  }

  seek(seconds: number) {
    const clamped = Math.max(0, Math.min(seconds, this._duration))
    if (this._isPlaying) {
      this.player.stop()
      this.player.start(undefined, clamped)
      this.startedAt = Tone.now()
      this.pauseOffset = clamped
    } else {
      this.pauseOffset = clamped
    }
    this.emit('audio:timeupdate', { currentTime: clamped, duration: this._duration })
  }

  getCurrentTime(): number {
    if (!this._isPlaying) return this.pauseOffset
    const elapsed = (Tone.now() - this.startedAt) * this.player.playbackRate
    return Math.min(this.pauseOffset + elapsed, this._duration)
  }

  /** Master volume 0–1 */
  setMasterVolume(value: number) {
    const clamped = Math.max(0, Math.min(1, value))
    const db = clamped <= 0 ? -Infinity : 20 * Math.log10(clamped)
    this.player.volume.rampTo(db, 0.05)
  }

  // ── Dial controls ──────────────────────────────────────────────────────────

  /** speed  0.5 – 2.0 */
  setSpeed(rate: number) {
    if (this._isPlaying) {
      // Checkpoint current position before changing rate
      this.pauseOffset = this.getCurrentTime()
      this.startedAt = Tone.now()
    }
    this._currentSpeedPercent = rate * 100
    this.player.playbackRate = Math.max(0.5, Math.min(2.0, rate))
  }

  /** weight  -6 – +12 dB   (low-shelf at 320 Hz) */
  setWeight(db: number) {
    this.lowShelf.gain.value = Math.max(-6, Math.min(12, db))
  }

  /** texture  0 – 0.8  (reverb wet) */
  setTexture(wet: number) {
    this.reverb.wet.value = Math.max(0, Math.min(0.8, wet))
  }

  /** brightness  -6 – +12 dB  (high-shelf at 3200 Hz) */
  setBrightness(db: number) {
    this.highShelf.gain.value = Math.max(-6, Math.min(12, db))
  }

  /** bass boost toggle  +6 dB shelf at 80 Hz */
  setBassBoost(enabled: boolean) {
    this.bassBoostFilter.gain.value = enabled ? 6 : 0
  }

  // ── Toggle effects ─────────────────────────────────────────────────────────

  /** Vinyl sim: subtle wow/flutter via LFO on playback rate ±0.002 at 0.5Hz */
  setVinylSim(enabled: boolean) {
    if (enabled) {
      this.vinylPhase = 0
      this.vinylIntervalId = setInterval(() => {
        this.vinylPhase += 0.05 // ~0.5Hz at 25ms interval → 0.05 * (1000/25) / (2π) ≈ 0.5Hz
        const wobble = Math.sin(this.vinylPhase) * 0.002
        const baseRate = this._currentSpeedPercent / 100
        this.player.playbackRate = Math.max(0.5, Math.min(2.0, baseRate + wobble))
      }, 25)
    } else {
      if (this.vinylIntervalId !== null) {
        clearInterval(this.vinylIntervalId)
        this.vinylIntervalId = null
      }
      // Reset to current speed dial value
      this.player.playbackRate = Math.max(0.5, Math.min(2.0, this._currentSpeedPercent / 100))
    }
  }

  /** Stereo wide: Chorus effect wet 0.3 on, 0 off */
  setStereoWide(enabled: boolean) {
    this.chorus.wet.value = enabled ? 0.3 : 0
  }

  // ── Oscilloscope data ─────────────────────────────────────────────────────

  getAnalyserNode(): AnalyserNode {
    return this.analyser
  }

  getTimeDomainData(): Float32Array {
    const arr = new Float32Array(this.analyser.fftSize)
    this.analyser.getFloatTimeDomainData(arr)
    return arr
  }

  getLeftChannelData(): Float32Array {
    if (this.leftAnalyser) {
      const arr = new Float32Array(this.leftAnalyser.fftSize)
      this.leftAnalyser.getFloatTimeDomainData(arr)
      return arr
    }
    return this.getTimeDomainData()
  }

  getRightChannelData(): Float32Array {
    if (this.rightAnalyser) {
      const arr = new Float32Array(this.rightAnalyser.fftSize)
      this.rightAnalyser.getFloatTimeDomainData(arr)
      return arr
    }
    return this.getTimeDomainData()
  }

  getBandTimeDomain(band: 'bass' | 'mid' | 'high'): Float32Array {
    const freqData = new Uint8Array(this.analyser.frequencyBinCount)
    this.analyser.getByteFrequencyData(freqData)

    let start: number, end: number
    if (band === 'bass') { start = 0; end = 10 }
    else if (band === 'mid') { start = 11; end = 100 }
    else { start = 101; end = Math.min(freqData.length - 1, 512) }

    const slice = freqData.slice(start, end + 1)
    const result = new Float32Array(256)
    for (let i = 0; i < 256; i++) {
      const binIdx = Math.floor((i / 256) * slice.length)
      result[i] = (slice[binIdx] / 128) - 1 // normalize 0-255 to -1..1
    }
    return result
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private startTimeUpdate() {
    this.stopTimeUpdate()
    this.timeUpdateId = setInterval(() => {
      const currentTime = this.getCurrentTime()
      if (currentTime >= this._duration) {
        this.stop()
        return
      }
      this.emit('audio:timeupdate', { currentTime, duration: this._duration })
    }, 250)
  }

  private stopTimeUpdate() {
    if (this.timeUpdateId !== null) {
      clearInterval(this.timeUpdateId)
      this.timeUpdateId = null
    }
  }

  private emit(name: string, detail?: unknown) {
    window.dispatchEvent(new CustomEvent(name, { detail }))
  }
}

export const audioEngine = new AudioEngine()
