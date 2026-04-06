import type { MHEUPlugin, ParamDescriptor } from '../MHEUPlugin';
import { pluginRegistry } from '../MHEUPlugin';

export class Distortion implements MHEUPlugin {
  readonly id = 'com.mheu.distortion';
  readonly name = 'Distortion';
  readonly input: GainNode;
  readonly output: GainNode;

  private waveshaper: WaveShaperNode;
  private toneFilter: BiquadFilterNode;
  private wetGain: GainNode;
  private dryGain: GainNode;
  private bypassed = false;

  private params: Record<string, ParamDescriptor> = {
    amount: { label: 'Amount', value: 20,   min: 0,   max: 100,  unit: '' },
    tone:   { label: 'Tone',   value: 3000, min: 200, max: 8000, unit: 'Hz' },
    output: { label: 'Output', value: 0.7,  min: 0,   max: 1,    unit: '' },
    wet:    { label: 'Wet',    value: 0.5,  min: 0,   max: 1,    unit: '' },
    dry:    { label: 'Dry',    value: 1.0,  min: 0,   max: 1,    unit: '' },
  };

  constructor(ctx: AudioContext) {
    this.input      = ctx.createGain();
    this.output     = ctx.createGain();
    this.waveshaper = ctx.createWaveShaper();
    this.toneFilter = ctx.createBiquadFilter();
    this.wetGain    = ctx.createGain();
    this.dryGain    = ctx.createGain();

    this.waveshaper.curve      = this.buildCurve(20);
    this.waveshaper.oversample = '4x';

    this.toneFilter.type            = 'highpass';
    this.toneFilter.frequency.value = 3000;

    this.output.gain.value  = 0.7;
    this.wetGain.gain.value = 0.5;
    this.dryGain.gain.value = 1.0;

    // Dry path: input → dryGain → output
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);

    // Wet path: input → waveshaper → toneFilter → wetGain → output
    this.input.connect(this.waveshaper);
    this.waveshaper.connect(this.toneFilter);
    this.toneFilter.connect(this.wetGain);
    this.wetGain.connect(this.output);
  }

  // Soft-clip sigmoid curve; amount controls aggressiveness
  private buildCurve(amount: number): Float32Array<ArrayBuffer> {
    const samples = 256;
    const curve   = new Float32Array(samples) as Float32Array<ArrayBuffer>;
    const k       = amount < 0.0001 ? 0.0001 : amount;
    for (let i = 0; i < samples; i++) {
      const x  = (i * 2) / samples - 1;
      curve[i] = (Math.PI + k) * x / (Math.PI + k * Math.abs(x));
    }
    return curve;
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
      case 'amount': this.waveshaper.curve            = this.buildCurve(p.value); break;
      case 'tone':   this.toneFilter.frequency.value  = p.value;                  break;
      case 'output': this.output.gain.value           = p.value;                  break;
      case 'wet':    if (!this.bypassed) this.wetGain.gain.value = p.value;       break;
      case 'dry':    if (!this.bypassed) this.dryGain.gain.value = p.value;       break;
    }
  }

  bypass(enabled: boolean): void {
    this.bypassed = enabled;
    this.wetGain.gain.value = enabled ? 0 : this.params.wet.value;
    this.dryGain.gain.value = enabled ? 1 : this.params.dry.value;
  }

  isBypassed(): boolean {
    return this.bypassed;
  }
}

pluginRegistry.set('Distortion', Distortion);
