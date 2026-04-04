import Meyda from 'meyda'
import type { BeatData } from '../types/audio'

class BeatDetector {
  private analyzer: ReturnType<typeof Meyda.createMeydaAnalyzer> | null = null
  private running = false

  start(audioContext: AudioContext, sourceNode: AudioNode) {
    if (this.running) this.stop()

    const bufferSize = 1024
    const sampleRate = audioContext.sampleRate
    const binWidth = sampleRate / bufferSize

    this.analyzer = Meyda.createMeydaAnalyzer({
      audioContext,
      source: sourceNode,
      bufferSize,
      featureExtractors: ['rms', 'spectralCentroid', 'amplitudeSpectrum'],
      callback: (features: Record<string, unknown>) => {
        if (!features || !features.amplitudeSpectrum) return

        const spectrum = features.amplitudeSpectrum as Float32Array
        const rms = (features.rms as number) ?? 0

        const bass = this.bandEnergy(spectrum, 20, 250, binWidth)
        const mid = this.bandEnergy(spectrum, 250, 4000, binWidth)
        const high = this.bandEnergy(spectrum, 4000, 20000, binWidth)

        const beatData: BeatData = {
          bass: Math.min(1, bass * 8),
          mid: Math.min(1, mid * 4),
          high: Math.min(1, high * 6),
          energy: Math.min(1, rms * 3),
        }

        window.dispatchEvent(new CustomEvent('audio:beat', { detail: beatData }))
      },
    })

    this.analyzer.start()
    this.running = true
  }

  stop() {
    if (this.analyzer) {
      this.analyzer.stop()
      this.analyzer = null
    }
    this.running = false
  }

  private bandEnergy(spectrum: Float32Array, lowHz: number, highHz: number, binWidth: number): number {
    const lowBin = Math.max(0, Math.floor(lowHz / binWidth))
    const highBin = Math.min(spectrum.length - 1, Math.ceil(highHz / binWidth))
    if (highBin <= lowBin) return 0

    let sum = 0
    for (let i = lowBin; i <= highBin; i++) {
      sum += spectrum[i] * spectrum[i]
    }
    return Math.sqrt(sum / (highBin - lowBin + 1))
  }
}

export const beatDetector = new BeatDetector()
