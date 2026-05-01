import React, { useState, useCallback, useEffect } from 'react';
import type { MHEUPlugin } from './MHEUPlugin';
import { PluginPanel } from './PluginPanel';
import { PluginChain } from './PluginChain';
import { getRegisteredPlugins, pluginRegistry } from './pluginRegistry';
import { Tooltip } from '../components/shared';

const ALL_PLUGINS = ['Compressor', 'EQ', 'Delay', 'Reverb', 'Chorus', 'Distortion'] as const;

const PLUGIN_TOOLTIPS: Record<string, string> = {
  Compressor: 'Reduces dynamic range — makes loud parts quieter and quiet parts louder',
  EQ: 'Equalizer — boost or cut frequency bands to shape the tone',
  Delay: 'Adds echoes of the audio signal with adjustable time and feedback',
  Reverb: 'Simulates room acoustics — adds space and depth to the sound',
  Chorus: 'Thickens the sound by layering slightly detuned copies',
  Distortion: 'Adds harmonic saturation and grit to the signal',
};

interface PluginRackProps {
  chain: PluginChain;
  audioContext: AudioContext;
}

/**
 * PluginRack — rack UI that renders the full plugin chain.
 *
 * Owns local mirror of chain order so React can re-render
 * on mutations. All mutations go through PluginChain and
 * then sync state.
 */
export function PluginRack({ chain, audioContext }: PluginRackProps) {
  const [plugins, setPlugins] = useState<MHEUPlugin[]>(() => chain.getChain());
  const [bypassed, setBypassed] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [rackCollapsed, setRackCollapsed] = useState(false);

  // Auto-preload all 6 plugins on mount (bypassed + collapsed)
  useEffect(() => {
    if (chain.getChain().length > 0) return;
    const bypassedInit: Record<string, boolean> = {};
    const collapsedInit: Record<string, boolean> = {};
    for (const name of ALL_PLUGINS) {
      const Ctor = pluginRegistry.get(name);
      if (!Ctor) continue;
      const plugin = new Ctor(audioContext);
      chain.addPlugin(plugin);
      chain.setBypass(plugin.id, true);
      bypassedInit[plugin.id] = true;
      collapsedInit[plugin.id] = true;
    }
    setPlugins(chain.getChain());
    setBypassed(bypassedInit);
    setCollapsed(collapsedInit);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync local state from chain after any mutation.
  const sync = useCallback(() => {
    setPlugins(chain.getChain());
  }, [chain]);

  const handleBypassToggle = useCallback(
    (id: string, enabled: boolean) => {
      chain.setBypass(id, enabled);
      setBypassed(prev => ({ ...prev, [id]: enabled }));
    },
    [chain]
  );

  const handleCollapseToggle = useCallback(
    (id: string, isCollapsed: boolean) => {
      setCollapsed(prev => ({ ...prev, [id]: isCollapsed }));
    },
    []
  );

  const handleAddPlugin = useCallback(
    (name: string) => {
      const Ctor = pluginRegistry.get(name);
      if (!Ctor) return;
      const plugin = new Ctor(audioContext);
      chain.addPlugin(plugin);
      sync();
      setAddMenuOpen(false);
    },
    [chain, audioContext, sync]
  );

  const availablePlugins = getRegisteredPlugins();

  return (
    <div className={`plugin-rack${rackCollapsed ? ' plugin-rack--collapsed' : ''}`} data-tutorial-id="plugin-rack">
      <div className="plugin-rack__header">
        <span className="plugin-rack__title">PLUGIN RACK</span>
        {!rackCollapsed && (
          <span className="plugin-rack__count">{plugins.length} UNIT{plugins.length !== 1 ? 'S' : ''}</span>
        )}
        <button
          className="plugin-rack__rack-toggle"
          onClick={() => setRackCollapsed(v => !v)}
          aria-label={rackCollapsed ? 'Expand rack' : 'Collapse rack'}
          title={rackCollapsed ? 'Expand rack' : 'Collapse rack'}
        >
          {rackCollapsed ? '▶' : '▼'}
        </button>
      </div>

      {!rackCollapsed && (
        <>
          <div
            className="plugin-rack__chain"
            onWheel={e => e.stopPropagation()}
          >
            {plugins.length === 0 && (
              <div className="plugin-rack__empty">No plugins in chain</div>
            )}
            {plugins.map(plugin => (
              <Tooltip key={plugin.id} text={plugin.name} detail={PLUGIN_TOOLTIPS[plugin.name] || 'Audio effect plugin'}>
              <div className="plugin-rack__slot">
                <PluginPanel
                  plugin={plugin}
                  bypassed={!!bypassed[plugin.id]}
                  collapsed={!!collapsed[plugin.id]}
                  onBypassToggle={handleBypassToggle}
                  onCollapseToggle={handleCollapseToggle}
                />
              </div>
              </Tooltip>
            ))}
          </div>

          {plugins.length < ALL_PLUGINS.length && (
          <div className="plugin-rack__footer">
            <div className="plugin-rack__add-wrap">
              <button
                className="plugin-rack__add-btn"
                onClick={() => setAddMenuOpen(v => !v)}
                disabled={availablePlugins.length === 0}
              >
                + ADD PLUGIN
              </button>
              {addMenuOpen && availablePlugins.length > 0 && (
                <div className="plugin-rack__dropdown">
                  {availablePlugins.map(name => (
                    <button
                      key={name}
                      className="plugin-rack__dropdown-item"
                      onClick={() => handleAddPlugin(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}
        </>
      )}

      <style>{`
        .plugin-rack {
          width: 260px;
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--bg-deep);
          border: var(--border-instrument);
          border-radius: 0;
          transition: width 0.15s ease;
        }
        .plugin-rack--collapsed {
          width: 36px;
        }
        .plugin-rack--collapsed .plugin-rack__title {
          display: none;
        }
        .plugin-rack--collapsed .plugin-rack__header {
          justify-content: center;
          padding: 8px 4px;
        }
        .plugin-rack__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          border-bottom: var(--border-instrument);
          background: var(--bg-panel);
          flex-shrink: 0;
        }
        .plugin-rack__title {
          font-family: var(--font-display);
          font-size: 11px;
          color: var(--red);
          letter-spacing: 0.12em;
          flex: 1;
        }
        .plugin-rack__count {
          font-family: var(--font-mono);
          font-size: 9px;
          color: var(--blue);
          opacity: 0.6;
          margin-right: 8px;
        }
        .plugin-rack__rack-toggle {
          background: transparent;
          border: none;
          color: var(--blue);
          font-size: 9px;
          cursor: pointer;
          padding: 2px 4px;
          opacity: 0.7;
          transition: opacity 0.1s, color 0.1s;
          line-height: 1;
        }
        .plugin-rack__rack-toggle:hover {
          opacity: 1;
          color: var(--amber);
        }
        .plugin-rack__chain {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 1px;
          padding: 4px 0;
          box-sizing: border-box;
        }
        .plugin-rack__empty {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--blue);
          opacity: 0.35;
          text-align: center;
          padding: 20px 0;
          letter-spacing: 0.06em;
        }
        .plugin-rack__slot {
          width: 100%;
          box-sizing: border-box;
          overflow: hidden;
        }
        .plugin-rack__footer {
          padding: 8px 12px;
          border-top: var(--border-instrument);
          background: var(--bg-panel);
          flex-shrink: 0;
        }
        .plugin-rack__add-wrap {
          position: relative;
          display: inline-block;
        }
        .plugin-rack__add-btn {
          font-family: var(--font-display);
          font-size: 9px;
          letter-spacing: 0.1em;
          padding: 5px 12px;
          background: transparent;
          border: 1px solid var(--teal);
          color: var(--teal);
          border-radius: 0;
          cursor: pointer;
          transition: background 0.1s, color 0.1s;
        }
        .plugin-rack__add-btn:not(:disabled):hover {
          background: var(--teal);
          color: var(--bg-deep);
        }
        .plugin-rack__add-btn:disabled {
          opacity: 0.3;
          cursor: default;
        }
        .plugin-rack__dropdown {
          position: absolute;
          bottom: calc(100% + 4px);
          left: 0;
          background: var(--bg-panel);
          border: var(--border-instrument);
          border-radius: 0;
          min-width: 140px;
          z-index: 100;
          display: flex;
          flex-direction: column;
        }
        .plugin-rack__dropdown-item {
          background: transparent;
          border: none;
          color: var(--amber);
          font-family: var(--font-ui);
          font-size: 11px;
          padding: 6px 10px;
          text-align: left;
          cursor: pointer;
          letter-spacing: 0.04em;
          transition: background 0.1s;
        }
        .plugin-rack__dropdown-item:hover {
          background: rgba(255, 179, 71, 0.12);
        }
      `}</style>
    </div>
  );
}
