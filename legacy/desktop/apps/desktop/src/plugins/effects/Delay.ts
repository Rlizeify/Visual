import type { MHEUPlugin, ParamDescriptor } from '../MHEUPlugin';
import { pluginRegistry } from '../MHEUPlugin';

export class Delay implements MHEUPlugin {
  readonly id = 'com.mheu.delay';
  readonly name = 'Delay';
  readonly input: GainNode;
  readonly output: GainNode;

  private delayNode:    DelayNode;
  private feedbackGain: GainNode;
  private wetGain:      GainNode;
  private dryGain:      GainNode;

  private params: Record<string, ParamDescriptor> = {
    delayTime: { label: 'Time',     value: 500, min: 0,   max: 2000, unit: 'ms'  },
    feedback:  { label: 'Feedback', value: 0.3, min: 0,   max: 0.95, unit: ''    },
    wet:       { label: 'Wet',      value: 0.5, min: 0,   max: 1,    unit: ''    },
    dry:       { label: 'Dry',      value: 1,   min: 0,   max: 1,    unit: ''    },
  };

  constructor(ctx: AudioContext) {
    this.input        = ctx.createGain();
    this.output       = ctx.createGain();
    this.delayNode    = ctx.createDelay(2.0);  // max 2 s
    this.feedbackGain = ctx.createGain();
    this.wetGain      = ctx.createGain();
    this.dryGain      = ctx.createGain();

    this.delayNode.delayTime.value  = 0.5;   // 500 ms
    this.feedbackGain.gain.value    = 0.3;
    this.wetGain.gain.value         = 0.5;
    this.dryGain.gain.value         = 1.0;

    // Dry path:  input → dryGain → output
    this.input.connect(this.dryGain);
    this.dryGain.connect(this.output);

    // Wet path:  input → delayNode → wetGain → output
    //                         ↑__feedbackGain__|
    this.input.connect(this.delayNode);
    this.delayNode.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delayNode);   // feedback loop
    this.delayNode.connect(this.wetGain);
    this.wetGain.connect(this.output);
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
      case 'delayTime': this.delayNode.delayTime.value = p.value / 1000; break;
      case 'feedback':  this.feedbackGain.gain.value   = p.value;        break;
      case 'wet':       this.wetGain.gain.value        = p.value;        break;
      case 'dry':       this.dryGain.gain.value        = p.value;        break;
    }
  }

  /**
   * Bypass sets wet to 0 and dry to 1 without disconnecting nodes,
   * preserving the feedback loop state.
   */
  bypass(enabled: boolean): void {
    if (enabled) {
      this.wetGain.gain.value  = 0;
      this.dryGain.gain.value  = 1;
    } else {
      this.wetGain.gain.value  = this.params.wet.value;
      this.dryGain.gain.value  = this.params.dry.value;
    }
  }

  isBypassed(): boolean {
    return this.wetGain.gain.value === 0 && this.dryGain.gain.value === 1;
  }
}

pluginRegistry.set('Delay', Delay);
