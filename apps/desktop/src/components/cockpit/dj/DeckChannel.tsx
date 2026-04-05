/* DeckChannel.tsx — single DJ deck: load, waveform, transport, faders, hot cues */

import { useState, useRef, useCallback, useEffect } from 'react'
import { DeckEngine } from './DeckEngine'
import DeckWaveform from './DeckWaveform'

interface Props {
  label: string
  engine: DeckEngine
}

export default function DeckChannel({ label, engine }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [pitch, setPitch] = useState(0)
  const [vol, setVol] = useState(75)
  const [hotCues, setHotCues] = useState<(number | null)[]>([null, null, null, null])
  const [cueSet, setCueSet] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const rafRef = useRef(0)

  // Animation loop for time updates
  useEffect(() => {
    const tick = () => {
      if (engine.playing) setTime(engine.currentTime)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [engine])

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await engine.loadFile(file)
    setLoaded(true)
    setPlaying(false)
    setTime(0)
    setCueSet(false)
    setHotCues([null, null, null, null])
    e.target.value = ''
  }, [engine])

  const togglePlay = useCallback(() => {
    if (engine.playing) { engine.pause(); setPlaying(false) }
    else { engine.play(); setPlaying(true) }
  }, [engine])

  const handleCue = useCallback(() => {
    if (!cueSet) { engine.setCue(); setCueSet(true) }
    else { engine.goToCue(); setPlaying(false) }
  }, [engine, cueSet])

  const handlePitch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    setPitch(v)
    engine.pitch = v
  }, [engine])

  const handleVol = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value)
    setVol(v)
    engine.volume = v
  }, [engine])

  const handleHotCue = useCallback((idx: number) => {
    if (hotCues[idx] != null) { engine.goToHotCue(idx); setPlaying(engine.playing) }
    else { engine.setHotCue(idx); setHotCues([...engine.hotCues]) }
  }, [engine, hotCues])

  const handleHotCueCtx = useCallback((e: React.MouseEvent, idx: number) => {
    e.preventDefault()
    engine.clearHotCue(idx)
    setHotCues([...engine.hotCues])
  }, [engine])

  const dur = engine.buffer?.duration ?? 0

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  }

  return (
    <div className="dj-deck">
      <div className="dj-deck__header">
        <span className="dj-deck__label">{label}</span>
        <button className="dj-deck__load" onClick={() => fileRef.current?.click()}>LOAD</button>
        <input ref={fileRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleFile} />
        <span className="dj-deck__name">{engine.fileName ?? '---'}</span>
        <span className="dj-deck__time">{fmt(time)} / {dur > 0 ? fmt(dur) : '--:--'}</span>
      </div>
      <DeckWaveform buffer={engine.buffer} currentTime={time} duration={dur} onSeek={(t) => { engine.seekTo(t); setTime(t) }} />
      <div className="dj-deck__controls">
        <button className={`dj-btn${playing ? ' active' : ''}`} onClick={togglePlay}>{playing ? 'PAUSE' : 'PLAY'}</button>
        <button className={`dj-btn${cueSet ? ' active' : ''}`} onClick={handleCue}>CUE</button>
        <div className="dj-hotcues">
          {[0, 1, 2, 3].map(i => (
            <button key={i} className={`dj-hotcue${hotCues[i] != null ? ' lit' : ''}`}
              onClick={() => handleHotCue(i)} onContextMenu={e => handleHotCueCtx(e, i)}>{i + 1}</button>
          ))}
        </div>
        <div className="dj-fader">
          <span className="dj-fader__label">PITCH</span>
          <input type="range" min="-8" max="8" step="0.1" value={pitch} onChange={handlePitch}
            className="dj-fader__input dj-fader__input--vert" title={`${pitch > 0 ? '+' : ''}${pitch.toFixed(1)}%`} />
        </div>
        <div className="dj-fader">
          <span className="dj-fader__label">VOL</span>
          <input type="range" min="0" max="100" step="1" value={vol} onChange={handleVol}
            className="dj-fader__input dj-fader__input--vert" title={`${vol}%`} />
        </div>
      </div>
    </div>
  )
}
