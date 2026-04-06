/* DeckChannel.tsx — single DJ deck: load, waveform, transport, faders, hot cues, FX, BPM/key */

import { useState, useRef, useCallback, useEffect } from 'react'
import { DeckEngine } from './DeckEngine'
import DeckWaveform from './DeckWaveform'
import DeckFXPanel from './DeckFXPanel'
import { Tooltip } from '../../shared'

interface Props {
  label: string
  engine: DeckEngine
  deckAEngine?: DeckEngine   // reference to Deck A for sync
}

export default function DeckChannel({ label, engine, deckAEngine }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [pitch, setPitch] = useState(0)
  const [vol, setVol] = useState(75)
  const [hotCues, setHotCues] = useState<(number | null)[]>([null, null, null, null])
  const [cueSet, setCueSet] = useState(false)
  const [bpm, setBpm] = useState<number | null>(null)
  const [detectedKey, setDetectedKey] = useState<string | null>(null)
  const [fxOpen, setFxOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const rafRef = useRef(0)

  // Animation loop for time updates + BPM/key polling
  useEffect(() => {
    const tick = () => {
      if (engine.playing) setTime(engine.currentTime)
      if (engine.bpm !== null && engine.bpm !== bpm) setBpm(engine.bpm)
      if (engine.detectedKey !== null && engine.detectedKey !== detectedKey) setDetectedKey(engine.detectedKey)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [engine, bpm, detectedKey])

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await engine.loadFile(file)
    setLoaded(true)
    setPlaying(false)
    setTime(0)
    setCueSet(false)
    setHotCues([null, null, null, null])
    setBpm(null)
    setDetectedKey(null)
    e.target.value = ''
  }, [engine])

  /** Use IPC dialog to load audio (gives us the full file path for persistence) */
  const handleLoadIPC = useCallback(async () => {
    const api = (window as any).api
    if (!api?.loadMp3) return
    const filePath: string | null = await api.loadMp3()
    if (!filePath) return

    // Check if this file is already in the media library
    let cachedBpm: number | null = null
    let cachedKey: string | null = null
    if (api.mediaList) {
      const rows: any[] = await api.mediaList({ mediaType: 'audio' })
      const existing = rows?.find((r: any) => r.file_path === filePath)
      if (existing?.metadata_json) {
        const meta = JSON.parse(existing.metadata_json)
        cachedBpm = meta.bpm ?? null
        cachedKey = meta.key ?? null
      }
    }

    const fileName = filePath.split(/[\\/]/).pop() ?? filePath
    const buf = await engine.loadFromPath(filePath, fileName, cachedBpm, cachedKey)
    if (!buf) return

    setLoaded(true)
    setPlaying(false)
    setTime(0)
    setCueSet(false)
    setHotCues([null, null, null, null])
    if (cachedBpm != null) setBpm(cachedBpm)
    else setBpm(null)
    if (cachedKey != null) setDetectedKey(cachedKey)
    else setDetectedKey(null)

    // Persist to media library
    if (api.mediaImport) {
      const row: any = await api.mediaImport({
        filePath,
        fileName,
        mediaType: 'audio',
      })
      // Store BPM/key once detected
      if (row && cachedBpm == null) {
        const checkAnalysis = setInterval(() => {
          if (engine.bpm != null && engine.detectedKey != null) {
            clearInterval(checkAnalysis)
            api.mediaUpdateMetadata({ id: row.id, metadata: { bpm: engine.bpm, key: engine.detectedKey } })
            // Update the audio library panel if present
            const addEntry = (window as any).__audioLibraryAdd
            if (addEntry) addEntry({ id: row.id, file_path: filePath, file_name: fileName, bpm: engine.bpm, key: engine.detectedKey, missing: false })
          }
        }, 500)
        setTimeout(() => clearInterval(checkAnalysis), 30000)
      } else if (row) {
        // Already have cached data, just notify the library panel
        const addEntry = (window as any).__audioLibraryAdd
        if (addEntry) addEntry({ id: row.id, file_path: filePath, file_name: fileName, bpm: cachedBpm, key: cachedKey, missing: false })
      }
    }
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

  const handleSync = useCallback(() => {
    if (!deckAEngine || !deckAEngine.bpm || !engine.bpm) return
    const targetBpm = deckAEngine.bpm
    const currentBpm = engine.bpm
    // pitch% needed: ((targetBpm / currentBpm) - 1) * 100
    const newPitch = ((targetBpm / currentBpm) - 1) * 100
    // Clamp to -8..+8
    const clamped = Math.max(-8, Math.min(8, newPitch))
    setPitch(clamped)
    engine.pitch = clamped
  }, [engine, deckAEngine])

  const dur = engine.buffer?.duration ?? 0
  const showSync = label !== 'A' && !!deckAEngine

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  }

  return (
    <div className="dj-deck">
      <div className="dj-deck__header">
        <span className="dj-deck__label">{label}</span>
        <Tooltip text="LOAD" detail="Load an audio file into this deck">
        <button className="dj-deck__load" onClick={handleLoadIPC}>LOAD</button>
        </Tooltip>
        <input ref={fileRef} type="file" accept="audio/*" style={{ display: 'none' }} onChange={handleFile} />
        <span className="dj-deck__name">{engine.fileName ?? '---'}</span>
        <div className="dj-deck__analysis" data-tutorial-id="deck-bpm-key">
          <span className="dj-deck__bpm">{bpm != null ? bpm.toFixed(1) : '---.-'}</span>
          <span className="dj-deck__key">{detectedKey ?? '---'}</span>
        </div>
        <span className="dj-deck__time">{fmt(time)} / {dur > 0 ? fmt(dur) : '--:--'}</span>
      </div>
      <DeckWaveform buffer={engine.buffer} currentTime={time} duration={dur} onSeek={(t) => { engine.seekTo(t); setTime(t) }} />
      <div className="dj-deck__controls">
        <button className={`dj-btn${playing ? ' active' : ''}`} onClick={togglePlay}>{playing ? 'PAUSE' : 'PLAY'}</button>
        <Tooltip text="CUE" detail="Set a return point. Press again to jump back to it.">
        <button className={`dj-btn${cueSet ? ' active' : ''}`} onClick={handleCue}>CUE</button>
        </Tooltip>
        <Tooltip text="HOT CUES" detail="Click to set a marker. Click again to jump to it. Right-click to clear.">
        <div className="dj-hotcues">
          {[0, 1, 2, 3].map(i => (
            <button key={i} className={`dj-hotcue${hotCues[i] != null ? ' lit' : ''}`}
              onClick={() => handleHotCue(i)} onContextMenu={e => handleHotCueCtx(e, i)}>{i + 1}</button>
          ))}
        </div>
        </Tooltip>
        <button className={`dj-btn dj-btn--fx${fxOpen ? ' active' : ''}`} data-tutorial-id="deck-fx" onClick={() => setFxOpen(v => !v)}>FX</button>
        {showSync && (
          <button className="dj-btn dj-btn--sync" onClick={handleSync} title="Match BPM to Deck A">SYNC</button>
        )}
        <Tooltip text="PITCH" detail="Adjust playback speed from -8% to +8%">
        <div className="dj-fader">
          <span className="dj-fader__label">PITCH</span>
          <input type="range" min="-8" max="8" step="0.1" value={pitch} onChange={handlePitch}
            className="dj-fader__input dj-fader__input--vert" title={`${pitch > 0 ? '+' : ''}${pitch.toFixed(1)}%`} />
        </div>
        </Tooltip>
        <div className="dj-fader">
          <span className="dj-fader__label">VOL</span>
          <input type="range" min="0" max="100" step="1" value={vol} onChange={handleVol}
            className="dj-fader__input dj-fader__input--vert" title={`${vol}%`} />
        </div>
      </div>
      {fxOpen && (
        <DeckFXPanel
          plugins={engine.fxPlugins}
          chain={engine.fxChain}
          onClose={() => setFxOpen(false)}
        />
      )}
    </div>
  )
}
