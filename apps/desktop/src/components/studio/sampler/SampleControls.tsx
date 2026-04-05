import React, { useCallback } from 'react'
import type { SampleState } from './SampleEngine'
import { Tooltip } from '../../shared'

interface Props {
  state: SampleState
  onLoad: () => void
  onPlay: () => void
  onStop: () => void
  onLoopToggle: (on: boolean) => void
  onPitchChange: (semitones: number) => void
  onStartChange: (ms: number) => void
  onEndChange: (ms: number) => void
  onReverseToggle: (on: boolean) => void
}

export default function SampleControls({
  state, onLoad, onPlay, onStop,
  onLoopToggle, onPitchChange, onStartChange, onEndChange, onReverseToggle,
}: Props) {
  const fmtMs = (sec: number) => (sec * 1000).toFixed(1)

  const handleStartInput = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = parseFloat((e.target as HTMLInputElement).value)
      if (!isNaN(val)) onStartChange(val / 1000)
    }
  }, [onStartChange])

  const handleEndInput = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = parseFloat((e.target as HTMLInputElement).value)
      if (!isNaN(val)) onEndChange(val / 1000)
    }
  }, [onEndChange])

  const handlePitchInput = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = parseInt((e.target as HTMLInputElement).value, 10)
      if (!isNaN(val)) onPitchChange(Math.max(-24, Math.min(24, val)))
    }
  }, [onPitchChange])

  return (
    <div className="sampler-controls">
      {/* Row 1: Transport — Load | Play/Pause | Stop */}
      <div className="sampler-controls__row">
        <Tooltip text="LOAD" detail="Load an audio sample for editing">
        <button className="studio-btn studio-btn--teal" onClick={onLoad}>
          LOAD
        </button>
        </Tooltip>
        <button
          className={`studio-btn ${state.playing ? 'studio-btn--amber active' : 'studio-btn--amber'}`}
          onClick={state.playing ? onStop : onPlay}
          disabled={!state.loaded}
          title={state.playing ? 'Pause playback' : 'Play the loaded sample'}
        >
          {state.playing ? 'PAUSE' : 'PLAY'}
        </button>
        <button className="studio-btn studio-btn--red studio-btn--small" onClick={onStop}
          disabled={!state.playing} title="Stop playback and reset">
          STOP
        </button>
        <span className="sampler-filename" title={state.fileName || 'No file'}>
          {state.fileName || '---'}
        </span>
      </div>

      {/* Row 2: Parameters */}
      <div className="sampler-controls__row">
        <Tooltip text="LOOP" detail="Loop the sample continuously">
        <button
          className={`studio-btn studio-btn--small ${state.loop ? 'studio-btn--amber active' : 'studio-btn--dim'}`}
          onClick={() => onLoopToggle(!state.loop)}>
          LOOP
        </button>
        </Tooltip>
        <Tooltip text="REVERSE" detail="Play the sample backwards">
        <button
          className={`studio-btn studio-btn--small ${state.reversed ? 'studio-btn--red active' : 'studio-btn--dim'}`}
          onClick={() => onReverseToggle(!state.reversed)}>
          REV
        </button>
        </Tooltip>

        <div className="sampler-param" title="Pitch shift in semitones (-24 to +24)">
          <label className="sampler-param__label">PITCH</label>
          <input
            className="sampler-param__input"
            type="text"
            defaultValue={String(state.pitchSemitones)}
            key={state.pitchSemitones}
            onKeyDown={handlePitchInput}
          />
          <span className="sampler-param__unit">st</span>
        </div>

        <div className="sampler-param" title="Loop/play start point">
          <label className="sampler-param__label">START</label>
          <input
            className="sampler-param__input"
            type="text"
            defaultValue={fmtMs(state.startTime)}
            key={`s-${state.startTime.toFixed(3)}`}
            onKeyDown={handleStartInput}
          />
          <span className="sampler-param__unit">ms</span>
        </div>

        <div className="sampler-param" title="Loop/play end point">
          <label className="sampler-param__label">END</label>
          <input
            className="sampler-param__input"
            type="text"
            defaultValue={fmtMs(state.endTime)}
            key={`e-${state.endTime.toFixed(3)}`}
            onKeyDown={handleEndInput}
          />
          <span className="sampler-param__unit">ms</span>
        </div>
      </div>
    </div>
  )
}
