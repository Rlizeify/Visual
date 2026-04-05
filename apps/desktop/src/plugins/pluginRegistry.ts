import type { MHEUPluginConstructor } from './MHEUPlugin';
import { pluginRegistry } from './MHEUPlugin';

export { pluginRegistry };

/**
 * Register a plugin constructor under a display name.
 * @param name         Human-readable name shown in the ADD PLUGIN menu.
 * @param constructor  Class that implements MHEUPlugin.
 */
export function registerPlugin(name: string, constructor: MHEUPluginConstructor): void {
  if (pluginRegistry.has(name)) {
    console.warn(`[PluginRegistry] Overwriting existing registration: "${name}"`);
  }
  pluginRegistry.set(name, constructor);
}

/**
 * Return all registered plugin names in insertion order.
 */
export function getRegisteredPlugins(): string[] {
  return Array.from(pluginRegistry.keys());
}
