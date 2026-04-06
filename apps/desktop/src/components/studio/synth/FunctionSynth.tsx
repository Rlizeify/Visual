import React, { useState, useRef, useCallback, useEffect } from 'react'

interface FunctionSynthProps {
  /** AudioContext shared with the additive synth */
  ctx: AudioContext | null
  /** Destination node to route audio through (e.g. the SynthEngine's analyser chain) */
  destination: AudioNode | null
}

/**
 * Renders a text input for a math function f(x,y,z) that generates audio.
 * x, y, z map to three independent frequency generators (220, 330, 440 Hz).
 * Output is sent to the provided destination and the XY oscilloscope.
 */
export default function FunctionSynth({ ctx, destination }: FunctionSynthProps) {
  const [expr, setExpr] = useState('x + y * sin(z)')
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const phaseRef = useRef({ x: 0, y: 0, z: 0 })

  // Cleanup on unmount
  useEffect(() => {
    return () => stopAudio()
  }, [])

  const stopAudio = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (gainRef.current) {
      gainRef.current.disconnect()
      gainRef.current = null
    }
    setPlaying(false)
  }, [])

  const startAudio = useCallback(() => {
    if (!ctx || !destination) return
    stopAudio()

    // Parse the user function
    let fn: (x: number, y: number, z: number, t: number) => number
    try {
      // Provide common math functions in scope
      const body = `
        const sin = Math.sin, cos = Math.cos, tan = Math.tan;
        const abs = Math.abs, sqrt = Math.sqrt, pow = Math.pow;
        const PI = Math.PI, E = Math.E;
        const log = Math.log, exp = Math.exp;
        const floor = Math.floor, ceil = Math.ceil;
        const min = Math.min, max = Math.max;
        return (${expr});
      `
      fn = new Function('x', 'y', 'z', 't', body) as any
      // Test it
      const test = fn(0, 0, 0, 0)
      if (typeof test !== 'number' || !isFinite(test)) {
        throw new Error('Result is not a finite number')
      }
      setError(null)
    } catch {
      setError('Invalid function')
      return
    }

    if (ctx.state === 'suspended') ctx.resume()

    const bufSize = 2048
    const processor = ctx.createScriptProcessor(bufSize, 0, 1)
    const gain = ctx.createGain()
    gain.gain.value = 0.3

    const freqX = 220, freqY = 330, freqZ = 440
    const sr = ctx.sampleRate
    const phase = phaseRef.current

    processor.onaudioprocess = (e) => {
      const out = e.outputBuffer.getChannelData(0)
      for (let i = 0; i < bufSize; i++) {
        const x = Math.sin(phase.x * 2 * Math.PI)
        const y = Math.sin(phase.y * 2 * Math.PI)
        const z = Math.sin(phase.z * 2 * Math.PI)
        const t = ctx.currentTime + i / sr

        let sample: number
        try {
          sample = fn(x, y, z, t)
        } catch {
          sample = 0
        }

        // Clamp to prevent blowouts
        if (!isFinite(sample)) sample = 0
        out[i] = Math.max(-1, Math.min(1, sample))

        phase.x += freqX / sr
        phase.y += freqY / sr
        phase.z += freqZ / sr
      }
    }

    processor.connect(gain)
    gain.connect(destination)
    processorRef.current = processor
    gainRef.current = gain
    setPlaying(true)
  }, [ctx, destination, expr, stopAudio])

  const togglePlay = useCallback(() => {
    if (playing) stopAudio()
    else startAudio()
  }, [playing, stopAudio, startAudio])

  const handleExprChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setExpr(e.target.value)
    setError(null)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (playing) {
        stopAudio()
        setTimeout(() => startAudio(), 10)
      }
    }
  }, [playing, stopAudio, startAudio])

  return (
    <div data-tutorial-id="studio-function-input" style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 6px', borderTop: '1px solid #2a2a2a', flexShrink: 0,
    }}>
      <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#666', letterSpacing: 1, flexShrink: 0 }}>
        f(x,y,z)=
      </span>
      <input
        type="text"
        value={expr}
        onChange={handleExprChange}
        onKeyDown={handleKeyDown}
        style={{
          flex: 1, minWidth: 0,
          fontFamily: 'monospace', fontSize: 11,
          background: '#111', color: '#ddd',
          border: `1px solid ${error ? '#f44' : '#444'}`,
          padding: '3px 6px', outline: 'none',
        }}
        title="Math function using x, y, z (frequency generators at 220, 330, 440 Hz) and t (time). Use sin, cos, abs, sqrt, etc."
      />
      <button
        onClick={togglePlay}
        style={{
          padding: '3px 10px', fontFamily: 'monospace', fontSize: 11, flexShrink: 0,
          background: playing ? '#1a3a1a' : '#1a1a1a',
          color: playing ? '#4f4' : '#aaa',
          border: `1px solid ${playing ? '#4f4' : '#444'}`,
          cursor: 'pointer',
        }}
      >
        {playing ? 'STOP' : 'PLAY'}
      </button>
      {error && (
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#f44', flexShrink: 0 }}>
          {error}
        </span>
      )}
    </div>
  )
}
