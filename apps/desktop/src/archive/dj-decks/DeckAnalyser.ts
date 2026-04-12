/* DeckAnalyser.ts — offline BPM + key detection for a single AudioBuffer */

const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// Major and minor profile templates (Krumhansl-Kessler)
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

export interface AnalysisResult {
  bpm: number | null
  key: string | null
}

/**
 * Analyse an AudioBuffer offline to detect BPM and musical key.
 * Returns a promise that resolves with the results.
 */
export async function analyseBuffer(buffer: AudioBuffer): Promise<AnalysisResult> {
  const mono = buffer.getChannelData(0)
  const sampleRate = buffer.sampleRate

  const bpm = detectBpm(mono, sampleRate)
  const key = detectKey(mono, sampleRate)

  return { bpm, key }
}

/* ── BPM detection via onset autocorrelation ──────────────────────────── */

function detectBpm(samples: Float32Array, sampleRate: number): number | null {
  // Use a 30-second window max for analysis
  const duration = Math.min(samples.length / sampleRate, 30)
  const sampleCount = Math.floor(duration * sampleRate)

  // Compute energy envelope with ~10ms hop
  const hopSize = Math.floor(sampleRate * 0.01)
  const frameSize = Math.floor(sampleRate * 0.02)
  const envLength = Math.floor(sampleCount / hopSize)
  const envelope = new Float32Array(envLength)

  for (let i = 0; i < envLength; i++) {
    const start = i * hopSize
    let sum = 0
    const end = Math.min(start + frameSize, sampleCount)
    for (let j = start; j < end; j++) {
      sum += samples[j] * samples[j]
    }
    envelope[i] = Math.sqrt(sum / (end - start))
  }

  // Onset detection: first-order difference, half-wave rectified
  const onset = new Float32Array(envLength)
  for (let i = 1; i < envLength; i++) {
    onset[i] = Math.max(0, envelope[i] - envelope[i - 1])
  }

  // Autocorrelation of onset signal in BPM range 60-200
  const minLag = Math.floor(60 / (200 * hopSize / sampleRate))  // lag for 200 BPM
  const maxLag = Math.floor(60 / (60 * hopSize / sampleRate))   // lag for 60 BPM
  const minLagSafe = Math.max(1, Math.floor((60 * sampleRate) / (200 * hopSize)))
  const maxLagSafe = Math.min(envLength - 1, Math.floor((60 * sampleRate) / (60 * hopSize)))

  let bestLag = minLagSafe
  let bestCorr = -Infinity

  for (let lag = minLagSafe; lag <= maxLagSafe; lag++) {
    let corr = 0
    const n = envLength - lag
    for (let i = 0; i < n; i++) {
      corr += onset[i] * onset[i + lag]
    }
    if (corr > bestCorr) {
      bestCorr = corr
      bestLag = lag
    }
  }

  if (bestCorr <= 0) return null

  const bpm = (60 * sampleRate) / (bestLag * hopSize)

  // Normalize to 60-200 range by doubling/halving
  let result = bpm
  while (result < 60) result *= 2
  while (result > 200) result /= 2

  return Math.round(result * 10) / 10
}

/* ── Key detection via chroma analysis ───────────────────────────────── */

function detectKey(samples: Float32Array, sampleRate: number): string | null {
  const fftSize = 4096
  // Analyse up to 30 seconds, sampling several windows
  const maxSamples = Math.min(samples.length, sampleRate * 30)
  const chroma = new Float32Array(12)
  const windowCount = Math.floor(maxSamples / fftSize)

  if (windowCount === 0) return null

  // Simple DFT-based chroma extraction
  // We'll use a subset of windows evenly spaced
  const step = Math.max(1, Math.floor(windowCount / 20))

  for (let w = 0; w < windowCount; w += step) {
    const offset = w * fftSize
    // Compute magnitude spectrum via DFT for key frequency bins only
    // For efficiency, only compute bins in the 60-5000 Hz range
    const minBin = Math.ceil((60 * fftSize) / sampleRate)
    const maxBin = Math.floor((5000 * fftSize) / sampleRate)

    for (let bin = minBin; bin <= maxBin; bin++) {
      const freq = (bin * sampleRate) / fftSize
      // Goertzel-like: compute magnitude for this bin
      let real = 0, imag = 0
      const omega = (2 * Math.PI * bin) / fftSize
      for (let n = 0; n < fftSize; n++) {
        const s = samples[offset + n] || 0
        real += s * Math.cos(omega * n)
        imag -= s * Math.sin(omega * n)
      }
      const mag = Math.sqrt(real * real + imag * imag)

      const pitchClass = Math.round(12 * Math.log2(freq / 440) + 9) % 12
      const pc = ((pitchClass % 12) + 12) % 12
      chroma[pc] += mag
    }
  }

  // Correlate with key profiles
  let bestKey = ''
  let bestCorr = -Infinity

  for (let root = 0; root < 12; root++) {
    // Rotate chroma to align with root
    const majorCorr = correlate(chroma, MAJOR_PROFILE, root)
    const minorCorr = correlate(chroma, MINOR_PROFILE, root)

    if (majorCorr > bestCorr) {
      bestCorr = majorCorr
      bestKey = PITCH_NAMES[root]
    }
    if (minorCorr > bestCorr) {
      bestCorr = minorCorr
      bestKey = PITCH_NAMES[root] + 'm'
    }
  }

  return bestKey || null
}

function correlate(chroma: Float32Array, profile: number[], root: number): number {
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += chroma[(i + root) % 12] * profile[i]
  }
  return sum
}
