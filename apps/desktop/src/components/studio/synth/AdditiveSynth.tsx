import React, { useState, useEffect, useRef, useCallback } from 'react'
import OscillatorLayer, { type OscillatorLayerConfig } from './OscillatorLayer'
import { SynthEngine, type LayerConfig } from './SynthEngine'
import WaveformDisplay from './WaveformDisplay'
import ExportButton from './ExportButton'

export interface AdditiveAudioRefs {
  ctx: AudioContext
  analyser: AnalyserNode
  masterGain: AudioNode
}

interface LayerState {
  id: string
  config: OscillatorLayerConfig
}

function makeLayer(): LayerState {
  return {
    id: crypto.randomUUID(),
    config: { waveType: 'sine', frequency: 440, gain: 0.5, detune: 0, enabled: true },
  }
}

interface AdditiveSynthProps {
  onEngineReady?: (refs: AdditiveAudioRefs) => void
}

export default function AdditiveSynth({ onEngineReady }: AdditiveSynthProps) {
  const [layers, setLayers] = useState<LayerState[]>(() => [makeLayer()])
  const [isPlaying, setIsPlaying] = useState(false)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)
  const engineRef = useRef<SynthEngine | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const prevLayerIdsRef = useRef<Set<string>>(new Set())

  // Init audio engine once
  useEffect(() => {
    const ctx = new AudioContext()
    const engine = new SynthEngine(ctx)
    ctxRef.current = ctx
    engineRef.current = engine
    // Clear tracked IDs so the layer-sync effect treats all layers as new
    prevLayerIdsRef.current = new Set()
    setAnalyser(engine.analyser)
    onEngineReady?.({ ctx, analyser: engine.analyser, masterGain: engine.analyser })
    return () => {
      engine.stopAll()
      ctx.close()
    }
  }, [])

  // Sync engine layers whenever state changes
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    const prevIds = prevLayerIdsRef.current
    const currIds = new Set(layers.map(l => l.id))

    // Remove deleted
    for (const id of prevIds) {
      if (!currIds.has(id)) engine.removeLayer(id)
    }

    // Add new or update existing
    for (const l of layers) {
      if (!prevIds.has(l.id)) engine.addLayer(l.id, l.config as LayerConfig)
      else engine.updateLayer(l.id, l.config as LayerConfig)
    }

    prevLayerIdsRef.current = currIds
  }, [layers])

  const addLayer = useCallback(() => {
    setLayers(prev => prev.length < 6 ? [...prev, makeLayer()] : prev)
  }, [])

  const removeLayer = useCallback((id: string) => {
    setLayers(prev => prev.filter(l => l.id !== id))
  }, [])

  const handleChange = useCallback((id: string, partial: Partial<OscillatorLayerConfig>) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, config: { ...l.config, ...partial } } : l))
  }, [])

  const togglePlay = useCallback(() => {
    const engine = engineRef.current
    const ctx = ctxRef.current
    if (!engine || !ctx) return
    if (isPlaying) {
      engine.stopAll()
      setIsPlaying(false)
    } else {
      if (ctx.state === 'suspended') ctx.resume()
      engine.startAll()
      setIsPlaying(true)
    }
  }, [isPlaying])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0d0d0d' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 8px', borderBottom: '1px solid #2a2a2a', flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#666', letterSpacing: 2 }}>
          ADDITIVE SYNTH — {layers.length}/6
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={togglePlay}
            style={{
              padding: '3px 10px', fontFamily: 'monospace', fontSize: 11,
              background: isPlaying ? '#1a3a1a' : '#1a1a1a',
              color: isPlaying ? '#4f4' : '#aaa',
              border: `1px solid ${isPlaying ? '#4f4' : '#444'}`,
              cursor: 'pointer',
            }}
          >
            {isPlaying ? 'STOP' : 'PLAY'}
          </button>
          <button
            onClick={addLayer}
            disabled={layers.length >= 6}
            style={{
              padding: '3px 10px', fontFamily: 'monospace', fontSize: 11,
              background: '#1a1a1a', color: layers.length >= 6 ? '#444' : '#aaa',
              border: `1px solid ${layers.length >= 6 ? '#2a2a2a' : '#444'}`,
              cursor: layers.length >= 6 ? 'default' : 'pointer',
            }}
          >
            + ADD LAYER
          </button>
        </div>
      </div>

      {/* Layer rows */}
      <div style={{ flex: '0 1 auto', minHeight: 0, overflowY: 'auto' }}>
        {layers.map(l => (
          <OscillatorLayer
            key={l.id}
            id={l.id}
            waveType={l.config.waveType}
            frequency={l.config.frequency}
            gain={l.config.gain}
            detune={l.config.detune}
            enabled={l.config.enabled}
            onChange={handleChange}
            onRemove={removeLayer}
          />
        ))}
      </div>

      {/* Waveform display */}
      <div style={{ flex: 1, minHeight: 60 }}>
        <WaveformDisplay analyser={analyser} />
      </div>

      {/* Export */}
      <div style={{ flexShrink: 0, padding: '4px 8px', borderTop: '1px solid #2a2a2a', display: 'flex', justifyContent: 'flex-end' }}>
        <ExportButton layers={layers.map(l => ({ id: l.id, config: l.config as LayerConfig }))} />
      </div>
    </div>
  )
}
