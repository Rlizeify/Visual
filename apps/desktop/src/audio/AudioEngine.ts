import * as Tone from 'tone'

class AudioEngine {
  private player: Tone.Player
  private bassBoostFilter: Tone.Filter
  private lowShelf: Tone.Filter
  private highShelf: Tone.Filter
  private reverb: Tone.Reverb
  private analysisNode: GainNode

  private _isLoaded = false
  private _isPlaying = false
  private _filename = ''
  private _duration = 0
  private startedAt = 0
  private pauseOffset = 0
  private timeUpdateId: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.player = new Tone.Player()
    this.player.loop = false

    // Effects chain nodes
    this.bassBoostFilter = new Tone.Filter({ type: 'lowshelf', frequency: 80, gain: 0 })
    this.lowShelf = new Tone.Filter({ type: 'lowshelf', frequency: 320, gain: 0 })
    this.highShelf = new Tone.Filter({ type: 'highshelf', frequency: 3200, gain: 0 })
    this.reverb = new Tone.Reverb({ decay: 1.5, wet: 0 })

    // Player → BassBoost → LowShelf → HighShelf → Reverb → Destination
    this.player.chain(
      this.bassBoostFilter,
      this.lowShelf,
      this.highShelf,
      this.reverb,
      Tone.getDestination(),
    )

    // Analysis tap — fan-out from player to a native GainNode for BeatDetector
    const ctx = Tone.getContext().rawContext as AudioContext
    this.analysisNode = ctx.createGain()
    this.analysisNode.gain.value = 1
    this.player.connect(this.analysisNode as unknown as Tone.ToneAudioNode)
  }

  // ── Expose internals for BeatDetector ──────────────────────────────────────

  getAudioContext(): AudioContext {
    return Tone.getContext().rawContext as AudioContext
  }

  getSourceNode(): GainNode {
    return this.analysisNode
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
