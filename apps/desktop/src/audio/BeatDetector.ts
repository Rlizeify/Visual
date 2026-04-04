import type { BeatData } from '../types/audio'

const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

class BeatDetector {
  private analyser: AnalyserNode | null = null
  private dataArray: Uint8Array | null = null
  private rafId: number | null = null
  private running = false
  private fftSize = 2048
  private sampleRate = 44100

  // BPM detection state
  private smoothedEnergy = 0
  private onsetHistory: number[] = []
  private currentBpm: number | null = null
  private lastBpmDispatch = 0
  private lastValidBpmTime = 0

  // Key detection state
  private chromaAccum = new Float32Array(12)
  private chromaResetTime = 0
  private lastKeyDispatch = 0

  start(audioContext: AudioContext, sourceNode: AudioNode) {
    if (this.running) this.stop()

    this.sampleRate = audioContext.sampleRate
    this.analyser = audioContext.createAnalyser()
    this.analyser.fftSize = this.fftSize
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount)

    // Listen only — do NOT connect analyser to destination
    sourceNode.connect(this.analyser)

    this.running = true
    this.smoothedEnergy = 0
    this.onsetHistory = []
    this.currentBpm = null
    this.lastBpmDispatch = 0
    this.lastValidBpmTime = 0
    this.chromaAccum.fill(0)
    this.chromaResetTime = Date.now()
    this.lastKeyDispatch = 0
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

    // BPM detection
    const bpm = this.detectBpm(energy)

    // Key detection
    this.accumulateChroma(this.dataArray)
    this.maybeDispatchKey()

    const beatData: BeatData = { bass, mid, high, energy, bpm: bpm ?? undefined }
    window.dispatchEvent(new CustomEvent('audio:beat', { detail: beatData }))

    this.rafId = requestAnimationFrame(this.tick)
  }

  private detectBpm(energy: number): number | null {
    const now = Date.now()

    // Exponential smoothing of energy
    const alpha = 0.1
    this.smoothedEnergy = this.smoothedEnergy * (1 - alpha) + energy * alpha

    // Onset detection: energy crosses above threshold
    const threshold = this.smoothedEnergy * 1.4
    if (energy > threshold && energy > 0.05) {
      // Debounce: ignore onsets within 200ms of last
      const lastOnset = this.onsetHistory[this.onsetHistory.length - 1]
      if (!lastOnset || now - lastOnset > 200) {
        this.onsetHistory.push(now)
      }
    }

    // Cull older than 4 seconds, keep max 16
    const cutoff = now - 4000
    this.onsetHistory = this.onsetHistory.filter((t) => t >= cutoff)
    if (this.onsetHistory.length > 16) {
      this.onsetHistory = this.onsetHistory.slice(-16)
    }

    // Calculate BPM when we have 4+ onsets
    if (this.onsetHistory.length >= 4) {
      let totalInterval = 0
      const count = this.onsetHistory.length - 1
      for (let i = 1; i < this.onsetHistory.length; i++) {
        totalInterval += this.onsetHistory[i] - this.onsetHistory[i - 1]
      }
      const avgInterval = totalInterval / count
      let newBpm = 60000 / avgInterval

      // Clamp to 60-200
      newBpm = Math.max(60, Math.min(200, newBpm))

      // Only update if within 15% of current, or stale
      const stale = !this.currentBpm || now - this.lastValidBpmTime > 3000
      const withinRange =
        this.currentBpm !== null &&
        Math.abs(newBpm - this.currentBpm) / this.currentBpm <= 0.15

      if (stale || withinRange) {
        this.currentBpm = Math.round(newBpm)
        this.lastValidBpmTime = now

        // Dispatch max once per 2 seconds
        if (now - this.lastBpmDispatch >= 2000) {
          this.lastBpmDispatch = now
          window.dispatchEvent(
            new CustomEvent('audio:bpm', { detail: { bpm: this.currentBpm } }),
          )
        }
      }
    }

    return this.currentBpm
  }

  private accumulateChroma(data: Uint8Array) {
    const now = Date.now()

    // Reset accumulator every 3 seconds
    if (now - this.chromaResetTime > 3000) {
      this.chromaAccum.fill(0)
      this.chromaResetTime = now
    }

    const binCount = data.length
    for (let i = 1; i < binCount; i++) {
      const freq = (i * this.sampleRate) / this.fftSize
      if (freq < 60 || freq > 5000) continue

      const pitchClass = Math.round(12 * Math.log2(freq / 440) + 9) % 12
      const pc = ((pitchClass % 12) + 12) % 12
      this.chromaAccum[pc] += data[i] / 255
    }
  }

  private maybeDispatchKey() {
    const now = Date.now()
    if (now - this.lastKeyDispatch < 5000) return
    this.lastKeyDispatch = now

    let maxVal = 0
    let maxIdx = 0
    for (let i = 0; i < 12; i++) {
      if (this.chromaAccum[i] > maxVal) {
        maxVal = this.chromaAccum[i]
        maxIdx = i
      }
    }

    if (maxVal > 0) {
      window.dispatchEvent(
        new CustomEvent('audio:key', { detail: { key: PITCH_NAMES[maxIdx] } }),
      )
    }
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
