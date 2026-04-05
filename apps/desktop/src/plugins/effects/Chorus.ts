import type { MHEUPlugin, ParamDescriptor } from '../MHEUPlugin';
import { pluginRegistry } from '../MHEUPlugin';

export class Chorus implements MHEUPlugin {
  readonly id = 'com.mheu.chorus';
  readonly name = 'Chorus';
  readonly input: GainNode;
  readonly output: GainNode;

  private delay: DelayNode;
  private lfo: OscillatorNode;
  private lfoDepth: GainNode;
  private wetGain: GainNode;
  private dryGain: GainNode;
  private bypassed = false;

  private params: Record<string, ParamDescriptor> = {
    rate:  { label: 'Rate',  value: 1.5, min: 0.1, max: 8,  unit: 'Hz' },
    depth: { label: 'Depth', value: 3.5, min: 0,   max: 20, unit: 'ms' },
    wet:   { label: 'Wet',   value: 0.5, min: 0,   max: 1,  unit: '' },
    dry:   { label: 'Dry',   value: 1.0, min: 0,   max: 1,  unit: '' },
  };

  constructor(ctx: AudioContext) {
    this.input    = ctx.createGain();
    this.output   = ctx.createGain();
    this.delay    = ctx.createDelay(0.1);
    this.lfo      = ctx.createOscillator();
    this.lfoDepth = ctx.createGain();
    this.wetGain  = ctx.createGain();
    this.dryGain  = ctx.createGain();

    // 20 ms center delay; LFO modulates ± (depth/2) ms around it
    this.delay.delayTime.value = 0.02;

    this.lfo.type            = 'sine';
    this.lfo.frequency.value = 1.5;
    this.lfoDepth.gain.value = 3.5 / 2000; // depth ms → seconds amplitude

    this.wetGain.gain.value = 0.5;
    this.dryGain.gain.value = 1.0;

    // LFO modulates delay time
    this.lfo.connect(this.lfoDepth);
    this.lfoDepth.connect(this.delay.delayTime);

    // Dry path: input → dryGain → output
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);

    // Wet path: input → delay → wetGain → output
    this.input.connect(this.delay);
    this.delay.connect(this.wetGain);
    this.wetGain.connect(this.output);

    this.lfo.start();
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
      case 'rate':  this.lfo.frequency.value = p.value;                        break;
      case 'depth': this.lfoDepth.gain.value = p.value / 2000;                 break;
      case 'wet':   if (!this.bypassed) this.wetGain.gain.value = p.value;     break;
      case 'dry':   if (!this.bypassed) this.dryGain.gain.value = p.value;     break;
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

pluginRegistry.set('Chorus', Chorus);
