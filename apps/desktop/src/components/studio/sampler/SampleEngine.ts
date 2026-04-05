// SampleEngine — Web Audio API sample playback with loop, pitch, reverse

export interface SampleState {
  loaded: boolean
  fileName: string
  duration: number
  startTime: number
  endTime: number
  loop: boolean
  pitchSemitones: number
  reversed: boolean
  playing: boolean
}

const DEFAULT_STATE: SampleState = {
  loaded: false,
  fileName: '',
  duration: 0,
  startTime: 0,
  endTime: 0,
  loop: false,
  pitchSemitones: 0,
  reversed: false,
  playing: false,
}

export class SampleEngine {
  private ctx: AudioContext
  private buffer: AudioBuffer | null = null
  private reversedBuffer: AudioBuffer | null = null
  private sourceNode: AudioBufferSourceNode | null = null
  private gainNode: GainNode
  state: SampleState = { ...DEFAULT_STATE }
  private onStateChange: (() => void) | null = null

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.gainNode = ctx.createGain()
    this.gainNode.connect(ctx.destination)
  }

  setOnStateChange(cb: () => void) {
    this.onStateChange = cb
  }

  private notify() {
    this.onStateChange?.()
  }

  getOutputNode(): GainNode {
    return this.gainNode
  }

  async loadBuffer(arrayBuffer: ArrayBuffer, fileName: string) {
    this.stop()
    this.buffer = await this.ctx.decodeAudioData(arrayBuffer)
    this.reversedBuffer = this.createReversed(this.buffer)
    this.state = {
      ...DEFAULT_STATE,
      loaded: true,
      fileName,
      duration: this.buffer.duration,
      endTime: this.buffer.duration,
    }
    this.notify()
  }

  private createReversed(buf: AudioBuffer): AudioBuffer {
    const reversed = this.ctx.createBuffer(
      buf.numberOfChannels, buf.length, buf.sampleRate
    )
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const src = buf.getChannelData(ch)
      const dst = reversed.getChannelData(ch)
      for (let i = 0; i < src.length; i++) {
        dst[i] = src[src.length - 1 - i]
      }
    }
    return reversed
  }

  getBuffer(): AudioBuffer | null {
    return this.state.reversed ? this.reversedBuffer : this.buffer
  }

  getRawBuffer(): AudioBuffer | null {
    return this.buffer
  }

  play() {
    if (!this.buffer) return
    this.stop()
    const buf = this.state.reversed ? this.reversedBuffer! : this.buffer
    const source = this.ctx.createBufferSource()
    source.buffer = buf
    source.playbackRate.value = Math.pow(2, this.state.pitchSemitones / 12)
    source.loop = this.state.loop
    if (this.state.loop) {
      source.loopStart = this.state.startTime
      source.loopEnd = this.state.endTime
    }
    source.connect(this.gainNode)
    const offset = this.state.startTime
    const dur = this.state.endTime - this.state.startTime
    source.start(0, offset, this.state.loop ? undefined : dur)
    source.onended = () => {
      this.state.playing = false
      this.sourceNode = null
      this.notify()
    }
    this.sourceNode = source
    this.state.playing = true
    this.notify()
  }

  stop() {
    if (this.sourceNode) {
      try { this.sourceNode.stop() } catch { /* already stopped */ }
      this.sourceNode.disconnect()
      this.sourceNode = null
    }
    this.state.playing = false
    this.notify()
  }

  setLoop(on: boolean) {
    this.state.loop = on
    this.notify()
  }

  setPitch(semitones: number) {
    this.state.pitchSemitones = semitones
    if (this.sourceNode) {
      this.sourceNode.playbackRate.value = Math.pow(2, semitones / 12)
    }
    this.notify()
  }

  setStartTime(t: number) {
    this.state.startTime = Math.max(0, Math.min(t, this.state.endTime - 0.01))
    this.notify()
  }

  setEndTime(t: number) {
    this.state.endTime = Math.min(
      this.state.duration, Math.max(t, this.state.startTime + 0.01)
    )
    this.notify()
  }

  setReversed(on: boolean) {
    const wasPlaying = this.state.playing
    if (wasPlaying) this.stop()
    this.state.reversed = on
    this.notify()
    if (wasPlaying) this.play()
  }

  setVolume(v: number) {
    this.gainNode.gain.value = v
  }

  dispose() {
    this.stop()
    this.gainNode.disconnect()
    this.buffer = null
    this.reversedBuffer = null
  }
}
