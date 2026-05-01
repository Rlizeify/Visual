/* DJDecks.tsx — 4-deck mixer: A/B with crossfader, C/D independent, master out */

import { useRef, useEffect, useState, useCallback } from 'react'
import { DeckEngine } from './DeckEngine'
import DeckChannel from './DeckChannel'
import AudioLibrary from './AudioLibrary'
import { registerDJStateHandlers, DJState } from './djState'
import { Tooltip } from '../../shared'

const DECK_IDS = ['A', 'B', 'C', 'D'] as const

export default function DJDecks() {
  const ctxRef = useRef<AudioContext | null>(null)
  const enginesRef = useRef<DeckEngine[]>([])
  const crossGainA = useRef<GainNode | null>(null)
  const crossGainB = useRef<GainNode | null>(null)
  const masterGain = useRef<GainNode | null>(null)
  const [xfader, setXfader] = useState(0.5)
  const [masterVol, setMasterVol] = useState(80)
  const [ready, setReady] = useState(false)
  const [selectedDeck, setSelectedDeck] = useState(0)

  // Initialize audio graph once
  useEffect(() => {
    const ctx = new AudioContext()
    ctxRef.current = ctx
    const master = ctx.createGain()
    master.gain.value = 0.8
    master.connect(ctx.destination)
    masterGain.current = master

    const gA = ctx.createGain(); gA.gain.value = 0.5
    const gB = ctx.createGain(); gB.gain.value = 0.5
    crossGainA.current = gA
    crossGainB.current = gB
    gA.connect(master)
    gB.connect(master)

    const engines: DeckEngine[] = DECK_IDS.map((_, i) => {
      const eng = new DeckEngine(ctx)
      if (i === 0) eng.output.connect(gA)
      else if (i === 1) eng.output.connect(gB)
      else eng.output.connect(master)
      return eng
    })
    enginesRef.current = engines
    setReady(true)

    // Register state handlers for djState.ts
    registerDJStateHandlers(
      () => ({
        decks: DECK_IDS.map((id, i) => ({
          id, filePath: engines[i].filePath, fileName: engines[i].fileName,
          cuePoint: engines[i].cuePoint, hotCues: [...engines[i].hotCues],
          pitch: engines[i].pitch, volume: engines[i].volume,
          isPlaying: engines[i].playing, currentTime: engines[i].currentTime,
          bpm: engines[i].bpm,
          detectedKey: engines[i].detectedKey,
          effects: engines[i].fxPlugins.map(p => ({
            pluginId: p.id,
            params: Object.fromEntries(
              Object.entries(p.getParams()).map(([k, d]) => [k, d.value])
            ),
            bypass: engines[i].fxChain.isBypassed(p.id),
          })),
        })),
        crossfader: xfader,
        masterVolume: masterVol,
      }),
      (s: DJState) => {
        s.decks.forEach((d, i) => {
          engines[i].pitch = d.pitch
          engines[i].volume = d.volume
          engines[i].cuePoint = d.cuePoint
          engines[i].hotCues = [...d.hotCues]
          // Restore effect states
          if (d.effects) {
            for (const fx of d.effects) {
              const plugin = engines[i].fxPlugins.find(p => p.id === fx.pluginId)
              if (!plugin) continue
              for (const [k, v] of Object.entries(fx.params)) {
                plugin.setParam(k, v)
              }
              engines[i].fxChain.setBypass(fx.pluginId, fx.bypass)
            }
          }
        })
        handleXfader(s.crossfader)
        handleMaster(s.masterVolume)
      }
    )

    return () => { ctx.close() }
  }, [])

  const handleXfader = useCallback((v: number) => {
    setXfader(v)
    if (crossGainA.current) crossGainA.current.gain.value = 1 - v
    if (crossGainB.current) crossGainB.current.gain.value = v
  }, [])

  const handleMaster = useCallback((v: number) => {
    setMasterVol(v)
    if (masterGain.current) masterGain.current.gain.value = v / 100
  }, [])

  const engines = enginesRef.current

  return (
    <div className="dj-section">
      <div className="dj-decks-row">
        {ready ? engines.map((eng, i) => (
          <DeckChannel key={DECK_IDS[i]} label={DECK_IDS[i]} engine={eng}
            deckAEngine={i !== 0 ? engines[0] : undefined} />
        )) : DECK_IDS.map((id) => (
          <div key={id} className="dj-deck">
            <div className="dj-deck__header">
              <span className="dj-deck__label">{id}</span>
            </div>
          </div>
        ))}
      </div>
      {ready && (
        <AudioLibrary engines={engines} deckLabels={DECK_IDS} selectedDeck={selectedDeck} />
      )}
      <div className="dj-footer">
        <Tooltip text="CROSSFADER" detail="Blend audio between Deck A and Deck B">
        <div className="dj-crossfader" data-tutorial-id="crossfader">
          <span className="dj-crossfader__label">A</span>
          <input type="range" min="0" max="1" step="0.01" value={xfader}
            onChange={e => handleXfader(parseFloat(e.target.value))}
            className="dj-crossfader__input" title={`Crossfader: ${Math.round(xfader * 100)}%`} />
          <span className="dj-crossfader__label">B</span>
        </div>
        </Tooltip>
        <div className="dj-master">
          <span className="dj-master__label">DECK MASTER</span>
          <input type="range" min="0" max="100" step="1" value={masterVol}
            onChange={e => handleMaster(parseInt(e.target.value))}
            className="dj-master__input" title={`Master: ${masterVol}%`} />
        </div>
      </div>
    </div>
  )
}
