import * as Tone from 'tone'
import type { DialSettings } from '../types/audio'

type OscillatorType = 'sine' | 'sawtooth' | 'triangle' | 'square'

interface ActiveOscillator {
  id: string
  type: OscillatorType
  frequency: number
  oscillator: Tone.Oscillator
  gainNode: Tone.Gain
}

class SynthEngine {
  private oscillators: ActiveOscillator[] = []
  private nextId = 0

  // Shared effects chain
  private lowShelf: Tone.Filter
  private filter: Tone.Filter
  private reverb: Tone.Reverb
  private masterGain: Tone.Gain
  private masterAnalyser: AnalyserNode | null = null
  private waveAnalysers: Map<string, AnalyserNode> = new Map()

  // For recording
  private mediaStreamDest: MediaStreamAudioDestinationNode | null = null

  private _isRunning = false
  private freqMultiplier = 1

  constructor() {
    this.lowShelf = new Tone.Filter({ type: 'lowshelf', frequency: 200, gain: 0 })
    this.filter = new Tone.Filter({ type: 'highshelf', frequency: 3200, gain: 0 })
    this.reverb = new Tone.Reverb({ decay: 1.5, wet: 0 })
    this.masterGain = new Tone.Gain(1)

    // Effects chain: lowShelf → filter → reverb → masterGain → destination
    this.lowShelf.connect(this.filter)
    this.filter.connect(this.reverb)
    this.reverb.connect(this.masterGain)
    this.masterGain.connect(Tone.getDestination())

    // Master analyser taps the output for oscilloscope visualization
    try {
      const ctx = Tone.getContext().rawContext as AudioContext
      this.masterAnalyser = ctx.createAnalyser()
      this.masterAnalyser.fftSize = 2048
      const nativeOut = (this.masterGain as any).output as AudioNode
      nativeOut.connect(this.masterAnalyser)
    } catch {
      this.masterAnalyser = null
    }
  }

  async ensureStarted() {
    if (!this._isRunning) {
      await Tone.start()
      this._isRunning = true
    }
  }

  async addWave(type: OscillatorType, frequency = 440): Promise<string> {
    await this.ensureStarted()
    const id = `synth_${this.nextId++}`
    const gainNode = new Tone.Gain(0.3)
    const oscillator = new Tone.Oscillator({
      type,
      frequency: frequency * this.freqMultiplier,
    })

    oscillator.connect(gainNode)
    gainNode.connect(this.lowShelf)
    oscillator.start()

    this.oscillators.push({ id, type, frequency, oscillator, gainNode })
    return id
  }

  removeWave(id: string) {
    const idx = this.oscillators.findIndex((o) => o.id === id)
    if (idx === -1) return
    const osc = this.oscillators[idx]
    osc.oscillator.stop()
    osc.oscillator.dispose()
    osc.gainNode.dispose()
    this.waveAnalysers.delete(id)
    this.oscillators.splice(idx, 1)
  }

  clearAll() {
    for (const osc of this.oscillators) {
      try { osc.oscillator.stop() } catch { /* already stopped */ }
      osc.oscillator.dispose()
      osc.gainNode.dispose()
    }
    this.oscillators = []
    this.waveAnalysers.clear()
  }

  setAmplitude(id: string, value: number) {
    const osc = this.oscillators.find((o) => o.id === id)
    if (osc) {
      osc.gainNode.gain.rampTo(Math.max(0, Math.min(1, value)), 0.05)
    }
  }

  setFrequency(id: string, hz: number) {
    const osc = this.oscillators.find((o) => o.id === id)
    if (osc) {
      osc.frequency = hz
      osc.oscillator.frequency.rampTo(hz * this.freqMultiplier, 0.05)
    }
  }

  setMasterVolume(value: number) {
    this.masterGain.gain.rampTo(Math.max(0, Math.min(1, value)), 0.05)
  }

  applyDialSettings(dialSettings: DialSettings) {
    // Weight → low-shelf bass boost at 200 Hz (-6 to +12 dB)
    this.lowShelf.gain.value = -6 + (dialSettings.weight / 100) * 18

    // Texture → reverb wet (0–0.8 mapped from 0–100)
    this.reverb.wet.rampTo((dialSettings.texture / 100) * 0.8, 0.1)

    // Brightness → high-shelf filter gain (-6 to +12 dB)
    this.filter.gain.value = -6 + (dialSettings.brightness / 100) * 18

    // Speed → frequency multiplier (0.5–2.0 mapped from 50–200 percent)
    this.freqMultiplier = dialSettings.speed / 100
    for (const osc of this.oscillators) {
      osc.oscillator.frequency.rampTo(osc.frequency * this.freqMultiplier, 0.1)
    }
  }

  async start() {
    await this.ensureStarted()
    for (const osc of this.oscillators) {
      try { osc.oscillator.start() } catch { /* already started */ }
    }
    this.emit('synth:started')
  }

  stop() {
    for (const osc of this.oscillators) {
      osc.oscillator.stop()
    }
    this.clearAll()
    this._isRunning = false
    this.emit('synth:stopped')
  }

  get isRunning() {
    return this._isRunning
  }

  getOscillators() {
    return this.oscillators.map((o) => ({
      id: o.id,
      type: o.type,
      frequency: o.frequency,
      amplitude: o.gainNode.gain.value,
    }))
  }

  // ── Oscilloscope data ──────────────────────────────────────────────────────

  getTimeDomainData(): Float32Array {
    if (!this.masterAnalyser) return new Float32Array(256)
    const arr = new Float32Array(this.masterAnalyser.fftSize)
    this.masterAnalyser.getFloatTimeDomainData(arr)
    return arr
  }

  getWaveTimeDomain(synthId: string): Float32Array {
    const osc = this.oscillators.find(o => o.id === synthId)
    if (!osc) return new Float32Array(256)

    let analyser = this.waveAnalysers.get(synthId)
    if (!analyser) {
      try {
        const ctx = Tone.getContext().rawContext as AudioContext
        analyser = ctx.createAnalyser()
        analyser.fftSize = 2048
        const nativeGain = (osc.gainNode as any).output as AudioNode
        nativeGain.connect(analyser)
        this.waveAnalysers.set(synthId, analyser)
      } catch {
        return new Float32Array(256)
      }
    }

    const arr = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(arr)
    return arr
  }

  getActiveWaveIds(): string[] {
    return this.oscillators.map(o => o.id)
  }

  // ── Recording ───────────────────────────────────────────────────────────────

  async recordAndSave(durationSeconds: number): Promise<void> {
    const ctx = Tone.getContext().rawContext as AudioContext
    this.mediaStreamDest = ctx.createMediaStreamDestination()

    // Tap the master gain into the media stream destination
    const nativeMaster = (this.masterGain as any).output?.context?._nativeAudioContext
      ? (this.masterGain as any).output
      : this.masterGain
    Tone.connect(nativeMaster, this.mediaStreamDest as unknown as Tone.ToneAudioNode)

    const recorder = new MediaRecorder(this.mediaStreamDest.stream, {
      mimeType: 'audio/webm;codecs=opus',
    })
    const chunks: Blob[] = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    const done = new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: 'audio/webm' }))
      }
    })

    recorder.start()

    await new Promise((r) => setTimeout(r, durationSeconds * 1000))
    recorder.stop()

    const blob = await done

    // Disconnect the tap
    try {
      Tone.disconnect(nativeMaster, this.mediaStreamDest as unknown as Tone.ToneAudioNode)
    } catch {
      // ignore disconnect errors
    }
    this.mediaStreamDest = null

    // Send to main process via IPC
    const buffer = await blob.arrayBuffer()
    const api = (window as any).api
    if (api?.saveSynthRecording) {
      await api.saveSynthRecording(Array.from(new Uint8Array(buffer)))
    }
  }

  private emit(name: string, detail?: unknown) {
    window.dispatchEvent(new CustomEvent(name, { detail }))
  }
}

export const synthEngine = new SynthEngine()
