import React, { useState, useCallback } from 'react';
import type { MHEUPlugin } from './MHEUPlugin';
import { PluginPanel } from './PluginPanel';
import { PluginChain } from './PluginChain';
import { getRegisteredPlugins, pluginRegistry } from './pluginRegistry';

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
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  // Sync local state from chain after any mutation.
  const sync = useCallback(() => {
    setPlugins(chain.getChain());
  }, [chain]);

  const handleMoveUp = useCallback(
    (id: string) => {
      const idx = plugins.findIndex(p => p.id === id);
      if (idx <= 0) return;
      chain.movePlugin(id, idx - 1);
      sync();
    },
    [chain, plugins, sync]
  );

  const handleMoveDown = useCallback(
    (id: string) => {
      const idx = plugins.findIndex(p => p.id === id);
      if (idx < 0 || idx >= plugins.length - 1) return;
      chain.movePlugin(id, idx + 1);
      sync();
    },
    [chain, plugins, sync]
  );

  const handleRemove = useCallback(
    (id: string) => {
      chain.removePlugin(id);
      setBypassed(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      sync();
    },
    [chain, sync]
  );

  const handleBypassToggle = useCallback(
    (id: string, enabled: boolean) => {
      chain.setBypass(id, enabled);
      setBypassed(prev => ({ ...prev, [id]: enabled }));
    },
    [chain]
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
    <div className="plugin-rack">
      <div className="plugin-rack__header">
        <span className="plugin-rack__title">PLUGIN RACK</span>
        <span className="plugin-rack__count">{plugins.length} UNIT{plugins.length !== 1 ? 'S' : ''}</span>
      </div>

      <div className="plugin-rack__chain">
        {plugins.length === 0 && (
          <div className="plugin-rack__empty">No plugins in chain</div>
        )}
        {plugins.map((plugin, idx) => (
          <div key={plugin.id} className="plugin-rack__slot">
            <div className="plugin-rack__controls">
              <button
                className="plugin-rack__arrow"
                onClick={() => handleMoveUp(plugin.id)}
                disabled={idx === 0}
                aria-label="Move up"
                title="Move up"
              >
                ▲
              </button>
              <button
                className="plugin-rack__arrow"
                onClick={() => handleMoveDown(plugin.id)}
                disabled={idx === plugins.length - 1}
                aria-label="Move down"
                title="Move down"
              >
                ▼
              </button>
              <button
                className="plugin-rack__remove"
                onClick={() => handleRemove(plugin.id)}
                aria-label="Remove plugin"
                title="Remove"
              >
                ✕
              </button>
            </div>
            <div className="plugin-rack__panel">
              <PluginPanel
                plugin={plugin}
                bypassed={!!bypassed[plugin.id]}
                onBypassToggle={handleBypassToggle}
              />
            </div>
          </div>
        ))}
      </div>

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

      <style>{`
        .plugin-rack {
          display: flex;
          flex-direction: column;
          gap: 0;
          background: var(--bg-deep);
          border: var(--border-instrument);
          border-radius: 6px;
          overflow: hidden;
          min-width: 280px;
        }
        .plugin-rack__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          border-bottom: var(--border-instrument);
          background: var(--bg-panel);
        }
        .plugin-rack__title {
          font-family: var(--font-display);
          font-size: 11px;
          color: var(--red);
          letter-spacing: 0.12em;
        }
        .plugin-rack__count {
          font-family: var(--font-mono);
          font-size: 9px;
          color: var(--blue);
          opacity: 0.6;
        }
        .plugin-rack__chain {
          display: flex;
          flex-direction: column;
          gap: 1px;
          padding: 6px;
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
          display: flex;
          align-items: stretch;
          gap: 4px;
        }
        .plugin-rack__controls {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding-top: 10px;
        }
        .plugin-rack__arrow {
          background: transparent;
          border: none;
          color: var(--amber);
          font-size: 9px;
          cursor: pointer;
          padding: 2px 3px;
          opacity: 0.7;
          transition: opacity 0.1s;
          line-height: 1;
        }
        .plugin-rack__arrow:disabled {
          opacity: 0.2;
          cursor: default;
        }
        .plugin-rack__arrow:not(:disabled):hover {
          opacity: 1;
        }
        .plugin-rack__remove {
          background: transparent;
          border: none;
          color: var(--red);
          font-size: 9px;
          cursor: pointer;
          padding: 2px 3px;
          opacity: 0.6;
          transition: opacity 0.1s;
          line-height: 1;
          margin-top: auto;
        }
        .plugin-rack__remove:hover {
          opacity: 1;
        }
        .plugin-rack__panel {
          flex: 1;
        }
        .plugin-rack__footer {
          padding: 8px 12px;
          border-top: var(--border-instrument);
          background: var(--bg-panel);
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
          border-radius: 2px;
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
          border-radius: 3px;
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
