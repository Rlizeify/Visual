import { useState, useEffect, useCallback, useRef } from 'react'
import { audioEngine } from '../audio/AudioEngine'
import { synthEngine } from '../audio/SynthEngine'
import { beatDetector } from '../audio/BeatDetector'
import type { AudioState, BeatData, DialSettings, AppMode, ActiveWave } from '../types/audio'

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

  const [bpm, setBpm] = useState<number | null>(null)
  const [detectedKey, setDetectedKey] = useState<string | null>(null)
  const [appMode, setAppMode] = useState<AppMode>('mp3')
  const [activeWaves, setActiveWaves] = useState<ActiveWave[]>([])

  const beatDetectorStarted = useRef(false)
  const beatSyncEnabled = useRef(false)

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
      if (beatSyncEnabled.current) {
        window.dispatchEvent(new CustomEvent('ui:beat-pulse'))
      }
    }

    const onBpm = (e: Event) => {
      const { bpm: newBpm } = (e as CustomEvent).detail
      setBpm(newBpm)
    }

    const onKey = (e: Event) => {
      const { key } = (e as CustomEvent).detail
      setDetectedKey(key)
    }

    window.addEventListener('audio:loaded', onLoaded)
    window.addEventListener('audio:playing', onPlaying)
    window.addEventListener('audio:paused', onPaused)
    window.addEventListener('audio:stopped', onStopped)
    window.addEventListener('audio:timeupdate', onTimeUpdate)
    window.addEventListener('audio:beat', onBeat)
    window.addEventListener('audio:bpm', onBpm)
    window.addEventListener('audio:key', onKey)

    return () => {
      window.removeEventListener('audio:loaded', onLoaded)
      window.removeEventListener('audio:playing', onPlaying)
      window.removeEventListener('audio:paused', onPaused)
      window.removeEventListener('audio:stopped', onStopped)
      window.removeEventListener('audio:timeupdate', onTimeUpdate)
      window.removeEventListener('audio:beat', onBeat)
      window.removeEventListener('audio:bpm', onBpm)
      window.removeEventListener('audio:key', onKey)
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
    setDialSettings((prev) => {
      const next = { ...prev, speed: percent }
      if (appMode === 'synth') synthEngine.applyDialSettings(next)
      return next
    })
    if (appMode === 'mp3') audioEngine.setSpeed(percent / 100)
  }, [appMode])

  const setWeight = useCallback((value: number) => {
    setDialSettings((prev) => {
      const next = { ...prev, weight: value }
      if (appMode === 'synth') synthEngine.applyDialSettings(next)
      return next
    })
    if (appMode === 'mp3') audioEngine.setWeight(-6 + (value / 100) * 18)
  }, [appMode])

  const setTexture = useCallback((value: number) => {
    setDialSettings((prev) => {
      const next = { ...prev, texture: value }
      if (appMode === 'synth') synthEngine.applyDialSettings(next)
      return next
    })
    if (appMode === 'mp3') audioEngine.setTexture((value / 100) * 0.8)
  }, [appMode])

  const setBrightness = useCallback((value: number) => {
    setDialSettings((prev) => {
      const next = { ...prev, brightness: value }
      if (appMode === 'synth') synthEngine.applyDialSettings(next)
      return next
    })
    if (appMode === 'mp3') audioEngine.setBrightness(-6 + (value / 100) * 18)
  }, [appMode])

  const setBassBoost = useCallback((enabled: boolean) => {
    audioEngine.setBassBoost(enabled)
  }, [])

  const setMasterVolume = useCallback((percent: number) => {
    const v = Math.max(0, Math.min(100, percent)) / 100
    audioEngine.setMasterVolume(v)
    synthEngine.setMasterVolume(v)
  }, [])

  // ── Toggle switch handlers ─────────────────────────────────────────────

  const setBeatSync = useCallback((enabled: boolean) => {
    beatSyncEnabled.current = enabled
  }, [])

  const setVinylSim = useCallback((enabled: boolean) => {
    audioEngine.setVinylSim(enabled)
  }, [])

  const setStereoWide = useCallback((enabled: boolean) => {
    audioEngine.setStereoWide(enabled)
  }, [])

  const setNightMode = useCallback((enabled: boolean) => {
    if (enabled) {
      document.documentElement.classList.add('night-mode')
    } else {
      document.documentElement.classList.remove('night-mode')
    }
  }, [])

  const setPushDisplay = useCallback((enabled: boolean) => {
    if (enabled) {
      const api = (window as any).api
      api?.send?.('hub:open-visualizer')
    }
  }, [])

  const updateSynthWave = useCallback((id: string, freq: number, amp: number) => {
    synthEngine.setFrequency(id, freq)
    synthEngine.setAmplitude(id, amp / 100)
    setActiveWaves((prev) => prev.map((w) => (w.id === id ? { ...w, frequency: freq, amplitude: amp } : w)))
  }, [])

  // ── Synth mode controls ─────────────────────────────────────────────────

  const switchToSynth = useCallback(() => {
    if (audioState.isPlaying) audioEngine.stop()
    setAppMode('synth')
    setActiveWaves([])
  }, [audioState.isPlaying])

  const switchToMp3 = useCallback(() => {
    synthEngine.stop()
    setAppMode('mp3')
    setActiveWaves([])
  }, [])

  const addSynthWave = useCallback(async (type: 'sine' | 'sawtooth' | 'triangle' | 'square', frequency = 440) => {
    const id = await synthEngine.addWave(type, frequency)
    setActiveWaves((prev) => [...prev, { id, type, amplitude: 0.3, frequency }])
    return id
  }, [])

  const removeSynthWave = useCallback((id: string) => {
    synthEngine.removeWave(id)
    setActiveWaves((prev) => prev.filter((w) => w.id !== id))
  }, [])

  const startSynth = useCallback(async () => {
    await synthEngine.start()
  }, [])

  const stopSynth = useCallback(() => {
    synthEngine.stop()
    setActiveWaves([])
  }, [])

  const setSynthAmplitude = useCallback((id: string, value: number) => {
    synthEngine.setAmplitude(id, value)
    setActiveWaves((prev) => prev.map((w) => (w.id === id ? { ...w, amplitude: value } : w)))
  }, [])

  const setSynthFrequency = useCallback((id: string, hz: number) => {
    synthEngine.setFrequency(id, hz)
    setActiveWaves((prev) => prev.map((w) => (w.id === id ? { ...w, frequency: hz } : w)))
  }, [])

  const recordSynth = useCallback(async (durationSeconds: number) => {
    await synthEngine.recordAndSave(durationSeconds)
  }, [])

  // ── IPC broadcast dial settings to display window ──────────────────────
  useEffect(() => {
    const api = (window as any).api
    if (api?.send) {
      api.send('visualizer:dial-data', dialSettings)
    }
  }, [dialSettings])

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

  // ── Apply night mode on mount (default on) ────────────────────────────
  useEffect(() => {
    document.documentElement.classList.add('night-mode')
  }, [])

  return {
    ...audioState,
    ...beatData,
    dialSettings,
    bpm,
    detectedKey,
    appMode,
    activeWaves,
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
    setBeatSync,
    setVinylSim,
    setStereoWide,
    setNightMode,
    setPushDisplay,
    switchToSynth,
    switchToMp3,
    addSynthWave,
    removeSynthWave,
    startSynth,
    stopSynth,
    setSynthAmplitude,
    setSynthFrequency,
    recordSynth,
    setMasterVolume,
    updateSynthWave,

    // Oscilloscope data
    getTimeDomainData: () => audioEngine.getTimeDomainData(),
    getLeftChannelData: () => audioEngine.getLeftChannelData(),
    getRightChannelData: () => audioEngine.getRightChannelData(),
    getBandTimeDomain: (band: 'bass' | 'mid' | 'high') => audioEngine.getBandTimeDomain(band),
  }
}
