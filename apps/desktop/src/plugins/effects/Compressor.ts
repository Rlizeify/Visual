import type { MHEUPlugin, ParamDescriptor } from '../MHEUPlugin';
import { pluginRegistry } from '../MHEUPlugin';

export class Compressor implements MHEUPlugin {
  readonly id = 'com.mheu.compressor';
  readonly name = 'Compressor';
  readonly input: GainNode;
  readonly output: GainNode;

  private compressor: DynamicsCompressorNode;
  private bypassed = false;

  private params: Record<string, ParamDescriptor> = {
    threshold: { label: 'Threshold', value: -24, min: -60, max: 0,    unit: 'dB' },
    ratio:     { label: 'Ratio',     value: 4,   min: 1,   max: 20,   unit: ':1' },
    attack:    { label: 'Attack',    value: 10,  min: 0,   max: 1000, unit: 'ms' },
    release:   { label: 'Release',   value: 250, min: 0,   max: 1000, unit: 'ms' },
    knee:      { label: 'Knee',      value: 10,  min: 0,   max: 40,   unit: 'dB' },
  };

  constructor(ctx: AudioContext) {
    this.input      = ctx.createGain();
    this.output     = ctx.createGain();
    this.compressor = ctx.createDynamicsCompressor();

    this.compressor.threshold.value = -24;
    this.compressor.ratio.value     = 4;
    this.compressor.attack.value    = 0.01;   // 10 ms
    this.compressor.release.value   = 0.25;   // 250 ms
    this.compressor.knee.value      = 10;

    // Normal signal path: input → compressor → output
    this.input.connect(this.compressor);
    this.compressor.connect(this.output);
  }

  // ─── MHEUPlugin ────────────────────────────────────────────────

  connect(destination: AudioNode): void {
    this.output.connect(destination);
  }

  disconnect(): void {
    this.output.disconnect();
  }

  getParams(): Record<string, ParamDescriptor> {
    return { ...this.params };
  }

  setParam(key: string, value: number): void {
    const p = this.params[key];
    if (!p) return;
    p.value = Math.max(p.min, Math.min(p.max, value));
    switch (key) {
      case 'threshold': this.compressor.threshold.value = p.value;          break;
      case 'ratio':     this.compressor.ratio.value     = p.value;          break;
      case 'attack':    this.compressor.attack.value    = p.value / 1000;   break;
      case 'release':   this.compressor.release.value   = p.value / 1000;   break;
      case 'knee':      this.compressor.knee.value      = p.value;          break;
    }
  }

  /**
   * Bypass routes audio around the DynamicsCompressorNode via a direct
   * GainNode passthrough (input → output), leaving the compressor idle.
   */
  bypass(enabled: boolean): void {
    this.bypassed = enabled;
    if (enabled) {
      this.compressor.disconnect(this.output);
      this.input.connect(this.output);
    } else {
      try { this.input.disconnect(this.output); } catch { /* not connected */ }
      this.compressor.connect(this.output);
    }
  }

  isBypassed(): boolean {
    return this.bypassed;
  }
}

pluginRegistry.set('Compressor', Compressor);
