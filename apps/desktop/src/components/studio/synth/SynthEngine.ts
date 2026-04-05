import type { WaveType } from './OscillatorLayer'

export type { WaveType }

export interface LayerConfig {
  waveType: WaveType
  frequency: number
  gain: number
  detune: number
  enabled: boolean
}

interface Layer {
  oscillator: OscillatorNode
  gainNode: GainNode
  config: LayerConfig
  started: boolean
}

const WAVE_MAP: Record<WaveType, OscillatorType> = {
  sine: 'sine',
  saw: 'sawtooth',
  triangle: 'triangle',
  square: 'square',
}

export class SynthEngine {
  private ctx: AudioContext
  private layers = new Map<string, Layer>()
  private masterGain: GainNode
  public analyser: AnalyserNode
  private running = false

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.masterGain = ctx.createGain()
    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 2048
    this.masterGain.connect(this.analyser)
    this.analyser.connect(ctx.destination)
  }

  private _build(config: LayerConfig): { oscillator: OscillatorNode; gainNode: GainNode } {
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = WAVE_MAP[config.waveType]
    osc.frequency.value = config.frequency
    osc.detune.value = config.detune
    gain.gain.value = config.enabled ? config.gain : 0
    osc.connect(gain)
    gain.connect(this.masterGain)
    return { oscillator: osc, gainNode: gain }
  }

  addLayer(id: string, config: LayerConfig) {
    if (this.layers.size >= 6) return
    const { oscillator, gainNode } = this._build(config)
    const layer: Layer = { oscillator, gainNode, config, started: false }
    this.layers.set(id, layer)
    if (this.running && config.enabled) {
      oscillator.start()
      layer.started = true
    }
  }

  updateLayer(id: string, config: LayerConfig) {
    const layer = this.layers.get(id)
    if (!layer) return
    layer.oscillator.type = WAVE_MAP[config.waveType]
    layer.oscillator.frequency.value = config.frequency
    layer.oscillator.detune.value = config.detune
    layer.gainNode.gain.value = config.enabled ? config.gain : 0
    layer.config = config
  }

  removeLayer(id: string) {
    const layer = this.layers.get(id)
    if (!layer) return
    if (layer.started) {
      try { layer.oscillator.stop() } catch { /* already stopped */ }
    }
    layer.oscillator.disconnect()
    layer.gainNode.disconnect()
    this.layers.delete(id)
  }

  startAll() {
    this.running = true
    for (const layer of this.layers.values()) {
      if (!layer.started && layer.config.enabled) {
        layer.oscillator.start()
        layer.started = true
      }
    }
  }

  // Stops all oscillators and recreates them so they can be restarted
  stopAll() {
    this.running = false
    const order: string[] = []
    const configs = new Map<string, LayerConfig>()
    for (const [id, layer] of this.layers) {
      order.push(id)
      configs.set(id, layer.config)
      if (layer.started) {
        try { layer.oscillator.stop() } catch { /* already stopped */ }
      }
      layer.oscillator.disconnect()
      layer.gainNode.disconnect()
    }
    this.layers.clear()
    for (const id of order) {
      const { oscillator, gainNode } = this._build(configs.get(id)!)
      this.layers.set(id, { oscillator, gainNode, config: configs.get(id)!, started: false })
    }
  }
}
