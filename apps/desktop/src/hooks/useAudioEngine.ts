import { useState, useEffect, useCallback, useRef } from 'react'
import { audioEngine } from '../audio/AudioEngine'
import { beatDetector } from '../audio/BeatDetector'
import type { AudioState, BeatData, DialSettings } from '../types/audio'

export function useAudioEngine() {
  const [audioState, setAudioState] = useState<AudioState>({
    isLoaded: false,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    filename: '',
  })

  const [beatData, setBeatData] = useState<BeatData>({
    bass: 0,
    mid: 0,
    high: 0,
    energy: 0,
  })

  const [dialSettings, setDialSettings] = useState<DialSettings>({
    speed: 100,
    weight: 50,
    texture: 20,
    brightness: 60,
  })

  const beatDetectorStarted = useRef(false)

  // ── Event listeners ──────────────────────────────────────────────────────

  useEffect(() => {
    const onLoaded = (e: Event) => {
      const { filename, duration } = (e as CustomEvent).detail
      setAudioState((prev) => ({
        ...prev,
        isLoaded: true,
        isPlaying: false,
        currentTime: 0,
        duration,
        filename,
      }))
    }

    const onPlaying = () =>
      setAudioState((prev) => ({ ...prev, isPlaying: true }))

    const onPaused = () =>
      setAudioState((prev) => ({ ...prev, isPlaying: false }))

    const onStopped = () =>
      setAudioState((prev) => ({ ...prev, isPlaying: false, currentTime: 0 }))

    const onTimeUpdate = (e: Event) => {
      const { currentTime, duration } = (e as CustomEvent).detail
      setAudioState((prev) => ({ ...prev, currentTime, duration }))
    }

    const onBeat = (e: Event) => {
      setBeatData((e as CustomEvent).detail as BeatData)
    }

    window.addEventListener('audio:loaded', onLoaded)
    window.addEventListener('audio:playing', onPlaying)
    window.addEventListener('audio:paused', onPaused)
    window.addEventListener('audio:stopped', onStopped)
    window.addEventListener('audio:timeupdate', onTimeUpdate)
    window.addEventListener('audio:beat', onBeat)

    return () => {
      window.removeEventListener('audio:loaded', onLoaded)
      window.removeEventListener('audio:playing', onPlaying)
      window.removeEventListener('audio:paused', onPaused)
      window.removeEventListener('audio:stopped', onStopped)
      window.removeEventListener('audio:timeupdate', onTimeUpdate)
      window.removeEventListener('audio:beat', onBeat)
    }
  }, [])

  // ── Controls ─────────────────────────────────────────────────────────────

  const load = useCallback(async (filepath: string) => {
    await audioEngine.load(filepath)
    if (!beatDetectorStarted.current) {
      const ctx = audioEngine.getAudioContext()
      const node = audioEngine.getSourceNode()
      beatDetector.start(ctx, node)
      beatDetectorStarted.current = true
    }
  }, [])

  const play = useCallback(() => audioEngine.play(), [])
  const pause = useCallback(() => audioEngine.pause(), [])
  const stop = useCallback(() => audioEngine.stop(), [])
  const seek = useCallback((s: number) => audioEngine.seek(s), [])

  const setSpeed = useCallback((percent: number) => {
    setDialSettings((prev) => ({ ...prev, speed: percent }))
    audioEngine.setSpeed(percent / 100)
  }, [])

  const setWeight = useCallback((value: number) => {
    setDialSettings((prev) => ({ ...prev, weight: value }))
    audioEngine.setWeight(-6 + (value / 100) * 18)
  }, [])

  const setTexture = useCallback((value: number) => {
    setDialSettings((prev) => ({ ...prev, texture: value }))
    audioEngine.setTexture((value / 100) * 0.8)
  }, [])

  const setBrightness = useCallback((value: number) => {
    setDialSettings((prev) => ({ ...prev, brightness: value }))
    audioEngine.setBrightness(-6 + (value / 100) * 18)
  }, [])

  const setBassBoost = useCallback((enabled: boolean) => {
    audioEngine.setBassBoost(enabled)
  }, [])

  // ── IPC broadcast beat data to display window ──────────────────────────
  useEffect(() => {
    const onBeat = (e: Event) => {
      const detail = (e as CustomEvent).detail
      const api = (window as any).api
      if (api?.send) {
        api.send('visualizer:beat-data', {
          bass: detail.bass,
          mid: detail.mid,
          high: detail.high,
          energy: detail.energy,
          isPlaying: true,
        })
      }
    }
    const onPaused = () => {
      const api = (window as any).api
      if (api?.send) {
        api.send('visualizer:beat-data', { bass: 0, mid: 0, high: 0, energy: 0, isPlaying: false })
      }
    }
    const onStopped = () => {
      const api = (window as any).api
      if (api?.send) {
        api.send('visualizer:beat-data', { bass: 0, mid: 0, high: 0, energy: 0, isPlaying: false })
      }
    }
    window.addEventListener('audio:beat', onBeat)
    window.addEventListener('audio:paused', onPaused)
    window.addEventListener('audio:stopped', onStopped)
    return () => {
      window.removeEventListener('audio:beat', onBeat)
      window.removeEventListener('audio:paused', onPaused)
      window.removeEventListener('audio:stopped', onStopped)
    }
  }, [])

  return {
    ...audioState,
    ...beatData,
    dialSettings,
    load,
    play,
    pause,
    stop,
    seek,
    setSpeed,
    setWeight,
    setTexture,
    setBrightness,
    setBassBoost,
  }
}
