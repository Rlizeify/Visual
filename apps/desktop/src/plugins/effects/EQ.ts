import type { MHEUPlugin, ParamDescriptor } from '../MHEUPlugin';
import { pluginRegistry } from '../MHEUPlugin';

export class EQ implements MHEUPlugin {
  readonly id = 'com.mheu.eq';
  readonly name = 'EQ';
  readonly input: GainNode;
  readonly output: GainNode;

  private lowShelf:  BiquadFilterNode;
  private midPeak:   BiquadFilterNode;
  private highShelf: BiquadFilterNode;
  private bypassed = false;

  private params: Record<string, ParamDescriptor> = {
    lowGain:  { label: 'Low Gain',  value: 0,    min: -12, max: 12,    unit: 'dB' },
    lowFreq:  { label: 'Low Freq',  value: 80,   min: 20,  max: 500,   unit: 'Hz' },
    midGain:  { label: 'Mid Gain',  value: 0,    min: -12, max: 12,    unit: 'dB' },
    midFreq:  { label: 'Mid Freq',  value: 1000, min: 200, max: 8000,  unit: 'Hz' },
    midQ:     { label: 'Mid Q',     value: 1,    min: 0.1, max: 10,    unit: ''   },
    highGain: { label: 'High Gain', value: 0,    min: -12, max: 12,    unit: 'dB' },
    highFreq: { label: 'High Freq', value: 8000, min: 2000,max: 20000, unit: 'Hz' },
  };

  constructor(ctx: AudioContext) {
    this.input     = ctx.createGain();
    this.output    = ctx.createGain();

    this.lowShelf  = ctx.createBiquadFilter();
    this.lowShelf.type      = 'lowshelf';
    this.lowShelf.frequency.value = 80;
    this.lowShelf.gain.value      = 0;

    this.midPeak   = ctx.createBiquadFilter();
    this.midPeak.type       = 'peaking';
    this.midPeak.frequency.value  = 1000;
    this.midPeak.Q.value          = 1;
    this.midPeak.gain.value       = 0;

    this.highShelf = ctx.createBiquadFilter();
    this.highShelf.type     = 'highshelf';
    this.highShelf.frequency.value = 8000;
    this.highShelf.gain.value      = 0;

    // Normal path: input → lowShelf → midPeak → highShelf → output
    this.input.connect(this.lowShelf);
    this.lowShelf.connect(this.midPeak);
    this.midPeak.connect(this.highShelf);
    this.highShelf.connect(this.output);
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
      case 'lowGain':  this.lowShelf.gain.value       = p.value; break;
      case 'lowFreq':  this.lowShelf.frequency.value  = p.value; break;
      case 'midGain':  this.midPeak.gain.value        = p.value; break;
      case 'midFreq':  this.midPeak.frequency.value   = p.value; break;
      case 'midQ':     this.midPeak.Q.value           = p.value; break;
      case 'highGain': this.highShelf.gain.value      = p.value; break;
      case 'highFreq': this.highShelf.frequency.value = p.value; break;
    }
  }

  /** Bypass routes audio around all three filters (input → output directly). */
  bypass(enabled: boolean): void {
    this.bypassed = enabled;
    if (enabled) {
      this.highShelf.disconnect(this.output);
      this.input.connect(this.output);
    } else {
      try { this.input.disconnect(this.output); } catch { /* not connected */ }
      this.highShelf.connect(this.output);
    }
  }

  isBypassed(): boolean {
    return this.bypassed;
  }
}

pluginRegistry.set('EQ', EQ);
