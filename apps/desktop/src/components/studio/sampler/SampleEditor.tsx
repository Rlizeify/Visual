import React, { useState, useCallback, useEffect, useRef } from 'react'
import SampleWaveform from './SampleWaveform'
import SampleControls from './SampleControls'
import { SampleEngine, type SampleState } from './SampleEngine'

const DEFAULT_STATE: SampleState = {
  loaded: false, fileName: '', duration: 0,
  startTime: 0, endTime: 0, loop: false,
  pitchSemitones: 0, reversed: false, playing: false,
}

export default function SampleEditor() {
  const ctxRef = useRef<AudioContext | null>(null)
  const engineRef = useRef<SampleEngine | null>(null)
  const [state, setState] = useState<SampleState>(DEFAULT_STATE)

  useEffect(() => {
    const ctx = new AudioContext()
    const engine = new SampleEngine(ctx)
    engine.setOnStateChange(() => setState({ ...engine.state }))
    ctxRef.current = ctx
    engineRef.current = engine
    return () => { engine.dispose(); ctx.close() }
  }, [])

  const handleLoad = useCallback(async () => {
    const filePath = await window.studioApi?.openSampleDialog()
    if (!filePath) return
    const data = await window.studioApi?.readAudioFile(filePath)
    if (!data) return
    const fileName = filePath.split(/[/\\]/).pop() || filePath
    await engineRef.current?.loadBuffer(data, fileName)
  }, [])

  const handlePlay = useCallback(() => engineRef.current?.play(), [])
  const handleStop = useCallback(() => engineRef.current?.stop(), [])
  const handleLoop = useCallback((on: boolean) => {
    engineRef.current?.setLoop(on)
  }, [])
  const handlePitch = useCallback((st: number) => {
    engineRef.current?.setPitch(st)
  }, [])
  const handleStart = useCallback((t: number) => {
    engineRef.current?.setStartTime(t)
  }, [])
  const handleEnd = useCallback((t: number) => {
    engineRef.current?.setEndTime(t)
  }, [])
  const handleReverse = useCallback((on: boolean) => {
    engineRef.current?.setReversed(on)
  }, [])

  return (
    <div className="sampler-editor">
      <div className="sampler-editor__header">
        <span className="panel-label">SAMPLE EDITOR</span>
      </div>
      <SampleWaveform
        buffer={engineRef.current?.getRawBuffer() ?? null}
        startTime={state.startTime}
        endTime={state.endTime}
        duration={state.duration}
        playing={state.playing}
        onStartChange={handleStart}
        onEndChange={handleEnd}
      />
      <SampleControls
        state={state}
        onLoad={handleLoad}
        onPlay={handlePlay}
        onStop={handleStop}
        onLoopToggle={handleLoop}
        onPitchChange={handlePitch}
        onStartChange={handleStart}
        onEndChange={handleEnd}
        onReverseToggle={handleReverse}
      />
    </div>
  )
}
