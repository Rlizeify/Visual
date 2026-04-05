import type { MHEUPlugin, ParamDescriptor } from '../MHEUPlugin';
import { pluginRegistry } from '../MHEUPlugin';

export class Reverb implements MHEUPlugin {
  readonly id = 'com.mheu.reverb';
  readonly name = 'Reverb';
  readonly input: GainNode;
  readonly output: GainNode;

  private convolver: ConvolverNode;
  private wetGain: GainNode;
  private dryGain: GainNode;
  private ctx: AudioContext;
  private bypassed = false;

  private params: Record<string, ParamDescriptor> = {
    roomSize: { label: 'Room Size', value: 2.5, min: 0.1, max: 10, unit: 's' },
    decay:    { label: 'Decay',     value: 0.5, min: 0,   max: 1,  unit: '' },
    wet:      { label: 'Wet',       value: 0.4, min: 0,   max: 1,  unit: '' },
    dry:      { label: 'Dry',       value: 1.0, min: 0,   max: 1,  unit: '' },
  };

  constructor(ctx: AudioContext) {
    this.ctx       = ctx;
    this.input     = ctx.createGain();
    this.output    = ctx.createGain();
    this.convolver = ctx.createConvolver();
    this.wetGain   = ctx.createGain();
    this.dryGain   = ctx.createGain();

    this.wetGain.gain.value = 0.4;
    this.dryGain.gain.value = 1.0;

    // Dry path: input → dryGain → output
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);

    // Wet path: input → convolver → wetGain → output
    this.input.connect(this.convolver);
    this.convolver.connect(this.wetGain);
    this.wetGain.connect(this.output);

    // Build initial impulse response via OfflineAudioContext
    this.buildImpulse(2.5, 0.5).then(buf => { this.convolver.buffer = buf; });
  }

  private async buildImpulse(roomSize: number, decay: number): Promise<AudioBuffer> {
    const rate    = this.ctx.sampleRate;
    const length  = Math.max(1, Math.floor(rate * roomSize));
    const offline = new OfflineAudioContext(2, length, rate);

    // White noise decaying exponentially — no external file needed
    const noise = offline.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = noise.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay * 10 + 1);
      }
    }

    const src = offline.createBufferSource();
    src.buffer = noise;
    src.connect(offline.destination);
    src.start(0);
    return offline.startRendering();
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
      case 'roomSize':
      case 'decay':
        this.buildImpulse(this.params.roomSize.value, this.params.decay.value)
          .then(buf => { this.convolver.buffer = buf; });
        break;
      case 'wet':
        if (!this.bypassed) this.wetGain.gain.value = p.value;
        break;
      case 'dry':
        if (!this.bypassed) this.dryGain.gain.value = p.value;
        break;
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

pluginRegistry.set('Reverb', Reverb);
