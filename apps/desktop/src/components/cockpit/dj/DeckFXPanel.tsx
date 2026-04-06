/* DeckFXPanel.tsx — per-deck FX popup with 6 effect plugins */

import { useState, useCallback } from 'react'
import type { MHEUPlugin, ParamDescriptor } from '../../../plugins/MHEUPlugin'
import { PluginChain } from '../../../plugins/PluginChain'

interface Props {
  plugins: MHEUPlugin[]
  chain: PluginChain
  onClose: () => void
}

export default function DeckFXPanel({ plugins, chain, onClose }: Props) {
  const [bypassed, setBypassed] = useState<Record<string, boolean>>(() => {
    const b: Record<string, boolean> = {}
    for (const p of plugins) b[p.id] = chain.isBypassed(p.id)
    return b
  })
  const [paramState, setParamState] = useState<Record<string, Record<string, ParamDescriptor>>>(() => {
    const ps: Record<string, Record<string, ParamDescriptor>> = {}
    for (const p of plugins) ps[p.id] = p.getParams()
    return ps
  })
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const handleBypass = useCallback((id: string) => {
    const next = !bypassed[id]
    chain.setBypass(id, next)
    setBypassed(prev => ({ ...prev, [id]: next }))
  }, [bypassed, chain])

  const handleParam = useCallback((pluginId: string, key: string, value: number) => {
    const plugin = plugins.find(p => p.id === pluginId)
    if (!plugin) return
    const desc = paramState[pluginId]?.[key]
    if (!desc) return
    const clamped = Math.max(desc.min, Math.min(desc.max, value))
    plugin.setParam(key, clamped)
    setParamState(prev => ({
      ...prev,
      [pluginId]: { ...prev[pluginId], [key]: { ...prev[pluginId][key], value: clamped } }
    }))
  }, [plugins, paramState])

  const toggleExpand = useCallback((id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }, [])

  return (
    <div className="deck-fx-panel">
      <div className="deck-fx-panel__header">
        <span className="deck-fx-panel__title">DECK FX</span>
        <button className="deck-fx-panel__close" onClick={onClose}>X</button>
      </div>
      <div className="deck-fx-panel__list">
        {plugins.map(plugin => {
          const isBypassed = bypassed[plugin.id]
          const isExpanded = !!expanded[plugin.id]
          const params = paramState[plugin.id] || {}
          return (
            <div key={plugin.id} className="deck-fx-slot" data-bypassed={isBypassed}>
              <div className="deck-fx-slot__header">
                <button className="deck-fx-slot__expand" onClick={() => toggleExpand(plugin.id)}>
                  {isExpanded ? '▼' : '▶'}
                </button>
                <span className="deck-fx-slot__name">{plugin.name}</span>
                <button
                  className={`deck-fx-slot__bypass${isBypassed ? '' : ' active'}`}
                  onClick={() => handleBypass(plugin.id)}
                >
                  {isBypassed ? 'OFF' : 'ON'}
                </button>
              </div>
              {isExpanded && (
                <div className="deck-fx-slot__params">
                  {Object.entries(params).map(([key, desc]) => (
                    <div key={key} className="deck-fx-param">
                      <label className="deck-fx-param__label">{desc.label}</label>
                      <input
                        type="range"
                        className="deck-fx-param__slider"
                        min={desc.min}
                        max={desc.max}
                        step={(desc.max - desc.min) / 200}
                        value={desc.value}
                        onChange={e => handleParam(plugin.id, key, parseFloat(e.target.value))}
                      />
                      <span className="deck-fx-param__value">
                        {desc.value.toFixed(desc.max >= 100 ? 0 : 2)}{desc.unit}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
