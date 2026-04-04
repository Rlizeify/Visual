import type { BeatData } from '../types/audio'

class BeatDetector {
  private analyser: AnalyserNode | null = null
  private dataArray: Uint8Array | null = null
  private rafId: number | null = null
  private running = false
  private fftSize = 2048
  private sampleRate = 44100

  start(audioContext: AudioContext, sourceNode: AudioNode) {
    if (this.running) this.stop()

    this.sampleRate = audioContext.sampleRate
    this.analyser = audioContext.createAnalyser()
    this.analyser.fftSize = this.fftSize
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount)

    // Listen only — do NOT connect analyser to destination
    sourceNode.connect(this.analyser)

    this.running = true
    this.tick()
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    if (this.analyser) {
      this.analyser.disconnect()
      this.analyser = null
    }
    this.dataArray = null
    this.running = false
  }

  private tick = () => {
    if (!this.running || !this.analyser || !this.dataArray) return

    this.analyser.getByteFrequencyData(this.dataArray as Uint8Array<ArrayBuffer>)

    const bass = this.bandAverage(this.dataArray, 20, 250)
    const mid = this.bandAverage(this.dataArray, 250, 4000)
    const high = this.bandAverage(this.dataArray, 4000, 20000)
    const energy = this.rms(this.dataArray)

    const beatData: BeatData = { bass, mid, high, energy }
    window.dispatchEvent(new CustomEvent('audio:beat', { detail: beatData }))

    this.rafId = requestAnimationFrame(this.tick)
  }

  private hzToBin(hz: number): number {
    return Math.round((hz * this.fftSize) / this.sampleRate)
  }

  private bandAverage(data: Uint8Array, lowHz: number, highHz: number): number {
    const lowBin = Math.max(0, this.hzToBin(lowHz))
    const highBin = Math.min(data.length - 1, this.hzToBin(highHz))
    if (highBin <= lowBin) return 0

    let sum = 0
    for (let i = lowBin; i <= highBin; i++) {
      sum += data[i]
    }
    return sum / ((highBin - lowBin + 1) * 255)
  }

  private rms(data: Uint8Array): number {
    let sum = 0
    for (let i = 0; i < data.length; i++) {
      const v = data[i] / 255
      sum += v * v
    }
    return Math.sqrt(sum / data.length)
  }
}

export const beatDetector = new BeatDetector()
