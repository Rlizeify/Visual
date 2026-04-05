import React, { useState, useCallback } from 'react';
import type { MHEUPlugin, ParamDescriptor } from './MHEUPlugin';

interface PluginPanelProps {
  plugin: MHEUPlugin;
  bypassed: boolean;
  onBypassToggle: (id: string, enabled: boolean) => void;
}

/**
 * PluginPanel — generic UI for any MHEUPlugin.
 *
 * Reads params from plugin.getParams() and renders
 * label + number input + range slider for each one.
 * Fully generic — no hardcoded param names.
 */
export function PluginPanel({ plugin, bypassed, onBypassToggle }: PluginPanelProps) {
  // Local state mirrors plugin param values for controlled inputs.
  const [params, setParams] = useState<Record<string, ParamDescriptor>>(
    () => plugin.getParams()
  );
  const [collapsed, setCollapsed] = useState(false);

  const handleChange = useCallback(
    (key: string, raw: number) => {
      const descriptor = params[key];
      const clamped = Math.max(descriptor.min, Math.min(descriptor.max, raw));
      plugin.setParam(key, clamped);
      setParams(prev => ({
        ...prev,
        [key]: { ...prev[key], value: clamped },
      }));
    },
    [params, plugin]
  );

  const handleNumberInput = useCallback(
    (key: string, strVal: string) => {
      const num = parseFloat(strVal);
      if (!Number.isNaN(num)) handleChange(key, num);
    },
    [handleChange]
  );

  return (
    <div className="plugin-panel" data-bypassed={bypassed}>
      <div className="plugin-panel__header">
        <span className="plugin-panel__name">{plugin.name}</span>
        <button
          className={`plugin-panel__bypass${bypassed ? ' plugin-panel__bypass--active' : ''}`}
          onClick={() => onBypassToggle(plugin.id, !bypassed)}
          aria-pressed={bypassed}
        >
          BYPASS
        </button>
        <button
          className="plugin-panel__collapse-btn"
          onClick={() => setCollapsed(v => !v)}
          aria-label={collapsed ? 'Expand plugin' : 'Collapse plugin'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '▶' : '▼'}
        </button>
      </div>

      {!collapsed && (
        <div className="plugin-panel__params">
          {Object.entries(params).map(([key, desc]) => (
            <div key={key} className="plugin-panel__param">
              <label className="plugin-panel__param-label" htmlFor={`${plugin.id}-${key}`}>
                {desc.label}
              </label>
              <div className="plugin-panel__param-controls">
                <input
                  id={`${plugin.id}-${key}`}
                  type="range"
                  className="plugin-panel__slider"
                  min={desc.min}
                  max={desc.max}
                  step={(desc.max - desc.min) / 1000}
                  value={desc.value}
                  onChange={e => handleChange(key, parseFloat(e.target.value))}
                />
                <div className="plugin-panel__number-wrap">
                  <input
                    type="number"
                    className="plugin-panel__number"
                    min={desc.min}
                    max={desc.max}
                    step={(desc.max - desc.min) / 1000}
                    value={desc.value}
                    onChange={e => handleNumberInput(key, e.target.value)}
                  />
                  {desc.unit && (
                    <span className="plugin-panel__unit">{desc.unit}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .plugin-panel {
          background: var(--bg-panel);
          border: var(--border-instrument);
          border-radius: 4px;
          opacity: 1;
          transition: opacity 0.15s;
        }
        .plugin-panel[data-bypassed="true"] {
          opacity: 0.45;
        }
        .plugin-panel__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 36px;
          padding: 0 8px 0 12px;
          gap: 8px;
        }
        .plugin-panel__name {
          font-family: var(--font-display);
          font-size: 11px;
          color: var(--amber);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .plugin-panel__bypass {
          font-family: var(--font-mono);
          font-size: 9px;
          padding: 2px 7px;
          background: transparent;
          border: 1px solid var(--amber);
          color: var(--amber);
          border-radius: 2px;
          cursor: pointer;
          letter-spacing: 0.1em;
          transition: background 0.1s, color 0.1s;
          flex-shrink: 0;
        }
        .plugin-panel__bypass--active {
          background: var(--amber);
          color: var(--bg-deep);
        }
        .plugin-panel__collapse-btn {
          background: transparent;
          border: none;
          color: var(--blue);
          font-size: 9px;
          cursor: pointer;
          padding: 2px 4px;
          opacity: 0.7;
          transition: opacity 0.1s, color 0.1s;
          flex-shrink: 0;
          line-height: 1;
        }
        .plugin-panel__collapse-btn:hover {
          opacity: 1;
          color: var(--amber);
        }
        .plugin-panel__params {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 0 12px 10px 12px;
        }
        .plugin-panel__param {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .plugin-panel__param-label {
          font-family: var(--font-ui);
          font-size: 10px;
          color: var(--blue);
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .plugin-panel__param-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .plugin-panel__slider {
          flex: 1;
          accent-color: var(--amber);
          height: 3px;
          cursor: pointer;
        }
        .plugin-panel__number-wrap {
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .plugin-panel__number {
          width: 58px;
          background: var(--bg-deep);
          border: var(--border-screen);
          color: var(--teal);
          font-family: var(--font-mono);
          font-size: 11px;
          padding: 2px 4px;
          border-radius: 2px;
          text-align: right;
        }
        .plugin-panel__number::-webkit-inner-spin-button,
        .plugin-panel__number::-webkit-outer-spin-button {
          opacity: 0.4;
        }
        .plugin-panel__unit {
          font-family: var(--font-mono);
          font-size: 9px;
          color: var(--blue);
          min-width: 18px;
        }
      `}</style>
    </div>
  );
}
