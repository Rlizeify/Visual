/* DeckEngine.ts — Web Audio node graph for one DJ deck */

export class DeckEngine {
  private ctx: AudioContext
  private source: AudioBufferSourceNode | null = null
  private gainNode: GainNode
  buffer: AudioBuffer | null = null
  fileName: string | null = null

  private _playing = false
  private _startedAt = 0   // ctx.currentTime when playback began
  private _offset = 0      // offset into buffer at start
  private _pitch = 0       // percent (-8 to +8)
  cuePoint = 0
  hotCues: (number | null)[] = [null, null, null, null]

  readonly output: GainNode  // connect this to crossfader or master

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.gainNode = ctx.createGain()
    this.gainNode.gain.value = 0.75
    this.output = this.gainNode
  }

  get playing() { return this._playing }

  get currentTime(): number {
    if (!this._playing) return this._offset
    const rate = 1 + this._pitch / 100
    return this._offset + (this.ctx.currentTime - this._startedAt) * rate
  }

  get volume() { return Math.round(this.gainNode.gain.value * 100) }
  set volume(v: number) { this.gainNode.gain.value = v / 100 }

  get pitch() { return this._pitch }
  set pitch(p: number) {
    this._pitch = p
    if (this.source) this.source.playbackRate.value = 1 + p / 100
  }

  async loadFile(file: File): Promise<AudioBuffer> {
    const arr = await file.arrayBuffer()
    this.buffer = await this.ctx.decodeAudioData(arr)
    this.fileName = file.name
    this._offset = 0
    this.cuePoint = 0
    this.hotCues = [null, null, null, null]
    this.stop()
    return this.buffer
  }

  play() {
    if (!this.buffer || this._playing) return
    this.source = this.ctx.createBufferSource()
    this.source.buffer = this.buffer
    this.source.playbackRate.value = 1 + this._pitch / 100
    this.source.connect(this.gainNode)
    this.source.onended = () => { if (this._playing) { this._playing = false } }
    const offset = Math.min(this._offset, this.buffer.duration)
    this.source.start(0, offset)
    this._startedAt = this.ctx.currentTime
    this._playing = true
  }

  pause() {
    if (!this._playing) return
    this._offset = this.currentTime
    this._stopSource()
    this._playing = false
  }

  stop() {
    this._stopSource()
    this._offset = 0
    this._playing = false
  }

  seekTo(t: number) {
    const wasPlaying = this._playing
    this._stopSource()
    this._playing = false
    this._offset = Math.max(0, Math.min(t, this.buffer?.duration ?? 0))
    if (wasPlaying) this.play()
  }

  setCue() { this.cuePoint = this.currentTime }
  goToCue() { this.seekTo(this.cuePoint) }

  setHotCue(idx: number) {
    if (idx < 0 || idx > 3) return
    this.hotCues[idx] = this.currentTime
  }

  goToHotCue(idx: number) {
    const t = this.hotCues[idx]
    if (t != null) this.seekTo(t)
  }

  clearHotCue(idx: number) { this.hotCues[idx] = null }

  private _stopSource() {
    try { this.source?.stop() } catch { /* already stopped */ }
    this.source?.disconnect()
    this.source = null
  }
}
