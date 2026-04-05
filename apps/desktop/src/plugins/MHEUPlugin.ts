/**
 * MHEUPlugin — contract every plugin must implement.
 *
 * MHEU = Multi-Host Effect Unit. All audio processing
 * modules in the rack must conform to this interface.
 */

export interface ParamDescriptor {
  value: number;
  min: number;
  max: number;
  unit: string;
  label: string;
}

export interface MHEUPlugin {
  /** Stable unique identifier (e.g. "com.mheu.compressor"). */
  readonly id: string;

  /** Human-readable display name. */
  readonly name: string;

  /** The Web Audio node that receives signal into this plugin. */
  readonly input: AudioNode;

  /** The Web Audio node that outputs signal from this plugin. */
  readonly output: AudioNode;

  /**
   * Connect this plugin's output to another node.
   * Called by PluginChain when wiring the chain.
   */
  connect(destination: AudioNode): void;

  /**
   * Disconnect all outputs.
   * Called by PluginChain before rewiring.
   */
  disconnect(): void;

  /**
   * Return all controllable parameters.
   * Keys are stable identifiers used in setParam().
   */
  getParams(): Record<string, ParamDescriptor>;

  /**
   * Update a single parameter value.
   * Implementations must clamp to [min, max].
   */
  setParam(key: string, value: number): void;

  /**
   * Enable or disable bypass.
   * When bypassed=true, PluginChain routes signal around this plugin.
   */
  bypass(enabled: boolean): void;
}

/**
 * Constructor signature for registering plugins in the registry.
 * Every concrete plugin class must be callable as `new Ctor(ctx)`.
 */
export type MHEUPluginConstructor = new (ctx: AudioContext) => MHEUPlugin;

/** Global registry mapping plugin names to their constructors. */
export const pluginRegistry = new Map<string, MHEUPluginConstructor>();
