// Fixed-capacity append-only buffer for accumulated waveform samples.
// One bucket = one ~100ms amplitude tick. When the buffer fills past
// `capacity`, samples are downsampled in place (pair-averaged), doubling
// the effective time-per-bucket so the song-shape stays visible end-to-end
// regardless of track length.

export class WaveformBuffer {
  private data: number[] = []
  private samplesPerBucket = 1
  private pending = 0
  private pendingCount = 0

  constructor(private readonly capacity: number = 200) {}

  push(value: number): void {
    this.pending += value
    this.pendingCount++
    if (this.pendingCount >= this.samplesPerBucket) {
      this.data.push(this.pending / this.pendingCount)
      this.pending = 0
      this.pendingCount = 0
      if (this.data.length >= this.capacity * 2) this.downsample()
    }
  }

  clear(): void {
    this.data = []
    this.samplesPerBucket = 1
    this.pending = 0
    this.pendingCount = 0
  }

  // Snapshot returns a copy so consumers can safely read in render.
  snapshot(): number[] {
    return this.data.slice()
  }

  size(): number {
    return this.data.length
  }

  // Pair-average adjacent buckets in place. Doubles the time each bucket
  // represents. Cheap O(n), runs only when buffer doubles past capacity.
  private downsample(): void {
    const half: number[] = []
    for (let i = 0; i + 1 < this.data.length; i += 2) {
      half.push((this.data[i] + this.data[i + 1]) * 0.5)
    }
    // Odd tail: keep it as a half-weight bucket
    if (this.data.length % 2 === 1) {
      half.push(this.data[this.data.length - 1])
    }
    this.data = half
    this.samplesPerBucket *= 2
  }
}
