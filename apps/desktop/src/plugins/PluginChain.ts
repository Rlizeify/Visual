import type { MHEUPlugin } from './MHEUPlugin';

/**
 * PluginChain — manages an ordered chain of MHEUPlugins.
 *
 * Responsibilities:
 * - Maintain insertion order.
 * - Rewire Web Audio connections whenever the chain mutates.
 * - Route audio around bypassed plugins transparently.
 */
export class PluginChain {
  private readonly ctx: AudioContext;
  private chain: MHEUPlugin[] = [];
  private bypassed: Set<string> = new Set();

  private source: AudioNode | null = null;
  private destination: AudioNode | null = null;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  // ─── Public API ────────────────────────────────────────────────

  /**
   * Add a plugin to the chain.
   * @param plugin  The plugin instance to insert.
   * @param index   Optional position. Appends to end if omitted.
   */
  addPlugin(plugin: MHEUPlugin, index?: number): void {
    if (this.chain.some(p => p.id === plugin.id)) {
      throw new Error(`Plugin "${plugin.id}" is already in the chain.`);
    }
    if (index === undefined || index >= this.chain.length) {
      this.chain.push(plugin);
    } else {
      this.chain.splice(Math.max(0, index), 0, plugin);
    }
    this._rewire();
  }

  /**
   * Remove a plugin by id.
   */
  removePlugin(id: string): void {
    const idx = this.chain.findIndex(p => p.id === id);
    if (idx === -1) return;
    this.chain[idx].disconnect();
    this.chain.splice(idx, 1);
    this.bypassed.delete(id);
    this._rewire();
  }

  /**
   * Move a plugin to a new position in the chain.
   */
  movePlugin(id: string, newIndex: number): void {
    const idx = this.chain.findIndex(p => p.id === id);
    if (idx === -1) return;
    const [plugin] = this.chain.splice(idx, 1);
    const clamped = Math.max(0, Math.min(newIndex, this.chain.length));
    this.chain.splice(clamped, 0, plugin);
    this._rewire();
  }

  /**
   * Return a shallow copy of the current chain order.
   */
  getChain(): MHEUPlugin[] {
    return [...this.chain];
  }

  /**
   * Set the audio source that feeds into the first plugin.
   */
  connectSource(source: AudioNode): void {
    this.source = source;
    this._rewire();
  }

  /**
   * Set the audio destination that receives the last plugin's output.
   */
  connectDestination(destination: AudioNode): void {
    this.destination = destination;
    this._rewire();
  }

  /**
   * Toggle bypass state for a plugin and rewire.
   * Also calls plugin.bypass() so the plugin can mute internal processing.
   */
  setBypass(id: string, enabled: boolean): void {
    if (enabled) {
      this.bypassed.add(id);
    } else {
      this.bypassed.delete(id);
    }
    const plugin = this.chain.find(p => p.id === id);
    if (plugin) plugin.bypass(enabled);
    this._rewire();
  }

  isBypassed(id: string): boolean {
    return this.bypassed.has(id);
  }

  // ─── Internal ──────────────────────────────────────────────────

  /**
   * Disconnect everything and rebuild connections from scratch.
   *
   * Signal flow:
   *   source → [active plugin inputs/outputs in order] → destination
   *
   * Bypassed plugins are skipped: the previous active node connects
   * directly to the next active node (or destination).
   */
  private _rewire(): void {
    // Disconnect all plugins first.
    for (const plugin of this.chain) {
      plugin.disconnect();
    }

    if (!this.source || !this.destination) return;
    if (this.chain.length === 0) {
      this.source.connect(this.destination);
      return;
    }

    // Build the active (non-bypassed) plugin list.
    const active = this.chain.filter(p => !this.bypassed.has(p.id));

    if (active.length === 0) {
      // All bypassed — pass through directly.
      this.source.connect(this.destination);
      return;
    }

    // source → first active input
    this.source.connect(active[0].input);

    // chain active plugins
    for (let i = 0; i < active.length - 1; i++) {
      active[i].connect(active[i + 1].input);
    }

    // last active output → destination
    active[active.length - 1].connect(this.destination);
  }
}
