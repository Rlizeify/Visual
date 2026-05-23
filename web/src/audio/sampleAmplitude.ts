// Pure helper: collapse an AnalyserNode's current frame to a single
// amplitude value in [0, 1]. Uses RMS over the time-domain waveform
// rather than spectrum average — better matches perceived loudness and
// avoids the high-frequency hiss bias of a flat frequency mean.

const SCRATCH = new Uint8Array(2048)

export function sampleAmplitude(analyser: AnalyserNode): number {
  const len = Math.min(SCRATCH.length, analyser.fftSize)
  // AnalyserNode.getByteTimeDomainData fills `len` bytes; if fftSize >
  // SCRATCH.length it reads the first len bytes — fine for our use case.
  analyser.getByteTimeDomainData(SCRATCH.subarray(0, len))
  let sumSquares = 0
  for (let i = 0; i < len; i++) {
    // Time-domain bytes are centred on 128. Map to [-1, 1].
    const v = (SCRATCH[i] - 128) / 128
    sumSquares += v * v
  }
  const rms = Math.sqrt(sumSquares / len)
  // RMS of a clean full-scale sine ≈ 0.707. Boost slightly so loud
  // music hits the upper register of the bar without clipping.
  return Math.min(1, rms * 1.4)
}
