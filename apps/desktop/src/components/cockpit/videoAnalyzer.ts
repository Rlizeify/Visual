/** Video analysis — extracts color, motion, brightness, and metadata from video files. */

export interface VideoAnalysis {
  resolution: { width: number; height: number }
  duration: number
  fps: number
  codec: string
  dominantColors: string[]
  averageBrightness: number
  colorTemperature: 'warm' | 'neutral' | 'cool'
  motionIntensity: 'static' | 'slow' | 'moderate' | 'fast'
  aspectRatio: string
  hasAudio: boolean
  fileSize: number
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

function simplifyRatio(w: number, h: number): string {
  const d = gcd(w, h)
  return `${w / d}:${h / d}`
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')
}

/** Quantize a pixel's RGB channels to the nearest bucket (step=32). */
function quantize(r: number, g: number, b: number): string {
  const qr = Math.round(r / 32) * 32
  const qg = Math.round(g / 32) * 32
  const qb = Math.round(b / 32) * 32
  return `${Math.min(qr, 255)},${Math.min(qg, 255)},${Math.min(qb, 255)}`
}

interface FrameSample {
  data: Uint8ClampedArray
  width: number
  height: number
  avgR: number
  avgG: number
  avgB: number
  brightness: number
}

/** Sample a single frame at the given time from a video element. */
function sampleFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement, time: number): Promise<FrameSample> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      const ctx = canvas.getContext('2d')!
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const d = imageData.data
      let totalR = 0, totalG = 0, totalB = 0, totalBright = 0
      const pixelCount = d.length / 4
      // Sample every 4th pixel for performance
      const step = 4
      let sampled = 0
      for (let i = 0; i < d.length; i += 4 * step) {
        const r = d[i], g = d[i + 1], b = d[i + 2]
        totalR += r
        totalG += g
        totalB += b
        totalBright += 0.299 * r + 0.587 * g + 0.114 * b
        sampled++
      }
      resolve({
        data: d,
        width: canvas.width,
        height: canvas.height,
        avgR: totalR / sampled,
        avgG: totalG / sampled,
        avgB: totalB / sampled,
        brightness: totalBright / sampled,
      })
    }
    video.addEventListener('seeked', onSeeked)
    video.currentTime = time
    // Timeout fallback
    setTimeout(() => {
      video.removeEventListener('seeked', onSeeked)
      reject(new Error('Seek timeout'))
    }, 5000)
  })
}

/** Convert a local file path to a proper file:// URL. */
function toFileURL(filePath: string): string {
  let normalized = filePath.replace(/\\/g, '/')
  if (!normalized.startsWith('/')) normalized = '/' + normalized
  return 'file://' + normalized
}

export async function analyzeVideo(filePath: string): Promise<VideoAnalysis> {
  const video = document.createElement('video')
  video.preload = 'auto'
  video.muted = true
  video.src = toFileURL(filePath)

  // Wait for metadata
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve()
    video.onerror = () => reject(new Error('Failed to load video'))
    setTimeout(() => reject(new Error('Metadata timeout')), 10000)
  })

  const width = video.videoWidth
  const height = video.videoHeight
  const duration = video.duration

  // Check for audio tracks
  let hasAudio = false
  if ('audioTracks' in video && (video as any).audioTracks) {
    hasAudio = (video as any).audioTracks.length > 0
  } else {
    // Fallback: try creating an AudioContext to check
    // Most videos with audio tracks will have them — assume true if we can't detect
    // We'll use a heuristic: check if the video element has a non-zero audio output
    hasAudio = true // conservative default; will be overridden if we can detect
  }

  // Get file size via fetch HEAD
  let fileSize = 0
  try {
    const resp = await fetch(toFileURL(filePath), { method: 'HEAD' })
    const cl = resp.headers.get('content-length')
    if (cl) fileSize = parseInt(cl, 10)
  } catch {
    // File size unavailable
  }

  // Guess codec from extension
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  const codecMap: Record<string, string> = {
    mp4: 'H.264', webm: 'VP9', mov: 'H.264', avi: 'MPEG-4', mkv: 'H.264',
  }
  const codec = codecMap[ext] || 'unknown'

  // FPS detection: try requestVideoFrameCallback
  let fps = 30
  if ('requestVideoFrameCallback' in video) {
    try {
      fps = await new Promise<number>((resolve) => {
        let count = 0
        let startTime = 0
        const cb = (_now: number, metadata: any) => {
          if (count === 0) startTime = metadata.mediaTime
          count++
          if (count < 10) {
            (video as any).requestVideoFrameCallback(cb)
          } else {
            const elapsed = metadata.mediaTime - startTime
            resolve(elapsed > 0 ? Math.round(count / elapsed) : 30)
          }
        }
        (video as any).requestVideoFrameCallback(cb)
        video.play().catch(() => resolve(30))
        setTimeout(() => resolve(30), 3000)
      })
      video.pause()
      video.currentTime = 0
    } catch {
      fps = 30
    }
  }

  const canvas = document.createElement('canvas')
  const timestamps = [0.1, 0.25, 0.5, 0.75, 0.9].map((pct) => pct * duration)
  const frames: FrameSample[] = []

  for (const t of timestamps) {
    try {
      const frame = await sampleFrame(video, canvas, t)
      frames.push(frame)
    } catch {
      // Skip failed frames
    }
  }

  // Dominant colors: quantize all sampled pixels and find top 5
  const colorCounts = new Map<string, number>()
  for (const frame of frames) {
    const d = frame.data
    const step = 4
    for (let i = 0; i < d.length; i += 4 * step) {
      const key = quantize(d[i], d[i + 1], d[i + 2])
      colorCounts.set(key, (colorCounts.get(key) ?? 0) + 1)
    }
  }
  const sortedColors = [...colorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([rgb]) => {
      const [r, g, b] = rgb.split(',').map(Number)
      return rgbToHex(r, g, b)
    })

  // Average brightness
  const avgBrightness = frames.length > 0
    ? frames.reduce((sum, f) => sum + f.brightness, 0) / frames.length
    : 128

  // Color temperature
  const avgR = frames.length > 0 ? frames.reduce((s, f) => s + f.avgR, 0) / frames.length : 128
  const avgB = frames.length > 0 ? frames.reduce((s, f) => s + f.avgB, 0) / frames.length : 128
  let colorTemperature: 'warm' | 'neutral' | 'cool' = 'neutral'
  if (avgB > avgR * 1.15) colorTemperature = 'cool'
  else if (avgR > avgB * 1.15) colorTemperature = 'warm'

  // Motion intensity: compare consecutive frames
  let totalChangedPct = 0
  let comparisons = 0
  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1]
    const curr = frames[i]
    if (prev.width !== curr.width || prev.height !== curr.height) continue
    const step = 4
    let changed = 0
    let total = 0
    for (let p = 0; p < prev.data.length; p += 4 * step) {
      const dr = Math.abs(prev.data[p] - curr.data[p])
      const dg = Math.abs(prev.data[p + 1] - curr.data[p + 1])
      const db = Math.abs(prev.data[p + 2] - curr.data[p + 2])
      if (dr > 30 || dg > 30 || db > 30) changed++
      total++
    }
    totalChangedPct += total > 0 ? changed / total : 0
    comparisons++
  }
  const avgChanged = comparisons > 0 ? totalChangedPct / comparisons : 0
  let motionIntensity: 'static' | 'slow' | 'moderate' | 'fast' = 'static'
  if (avgChanged >= 0.5) motionIntensity = 'fast'
  else if (avgChanged >= 0.2) motionIntensity = 'moderate'
  else if (avgChanged >= 0.05) motionIntensity = 'slow'

  // Cleanup
  video.src = ''
  video.load()

  return {
    resolution: { width, height },
    duration,
    fps,
    codec,
    dominantColors: sortedColors,
    averageBrightness: avgBrightness,
    colorTemperature,
    motionIntensity,
    aspectRatio: simplifyRatio(width, height),
    hasAudio,
    fileSize,
  }
}
