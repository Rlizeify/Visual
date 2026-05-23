/**
 * Shared audio source for the M-tab UI.
 *
 * Public API
 * ----------
 * useAudioSource(): {
 *   waveform: number[]    // 0..1 amplitudes, length grows then downsamples to ≤200
 *   position: number      // seconds, current playback position (interpolated)
 *   duration: number      // seconds, total track duration (0 if unknown)
 *   trackId: string | null
 *   hasStream: boolean    // true once the user has shared tab/system audio
 * }
 *
 * Behaviour
 * ---------
 * - Samples the engine's shared AnalyserNode every SAMPLE_MS (~100ms) when a
 *   stream is active. Pushes the amplitude into a WaveformBuffer.
 * - Resets the buffer when the Spotify `trackId` changes.
 * - When no stream is active, `waveform` is `[]`. Consumers render empty.
 * - When no track is loaded (`duration === 0`), the buffer still grows on
 *   any amplitude — the progress portion just stays at 0.
 *
 * Concurrency
 * -----------
 * Module-level singleton — there is exactly one sampler running per page
 * regardless of how many components call `useAudioSource()`. Each subscriber
 * gets a re-render on every snapshot tick.
 */

import { useEffect, useState } from 'react'
import { getLiveAnalyser } from './liveAnalyser'
import { sampleAmplitude } from './sampleAmplitude'
import { WaveformBuffer } from './waveformBuffer'
import { getPositionSnapshot } from './positionSource'

const SAMPLE_MS = 100
const CAPACITY = 200

export interface AudioSourceSnapshot {
  waveform: number[]
  position: number
  duration: number
  trackId: string | null
  hasStream: boolean
}

const buffer = new WaveformBuffer(CAPACITY)
let lastTrackId: string | null = null
const listeners = new Set<() => void>()
let intervalId: ReturnType<typeof setInterval> | null = null
let refCount = 0

function tick(): void {
  const analyser = getLiveAnalyser()
  const { trackId } = getPositionSnapshot()

  if (trackId !== lastTrackId) {
    buffer.clear()
    lastTrackId = trackId
  }

  if (analyser) buffer.push(sampleAmplitude(analyser))

  for (const fn of listeners) fn()
}

function start(): void {
  if (intervalId !== null) return
  intervalId = setInterval(tick, SAMPLE_MS)
}

function stop(): void {
  if (intervalId === null) return
  clearInterval(intervalId)
  intervalId = null
}

export function getAudioSnapshot(): AudioSourceSnapshot {
  const { trackId, position, duration } = getPositionSnapshot()
  return {
    waveform: buffer.snapshot(),
    position,
    duration,
    trackId,
    hasStream: getLiveAnalyser() !== null,
  }
}

export function useAudioSource(): AudioSourceSnapshot {
  const [snap, setSnap] = useState<AudioSourceSnapshot>(() => getAudioSnapshot())

  useEffect(() => {
    refCount++
    if (refCount === 1) start()

    const listener = () => setSnap(getAudioSnapshot())
    listeners.add(listener)

    return () => {
      listeners.delete(listener)
      refCount--
      if (refCount === 0) stop()
    }
  }, [])

  return snap
}
