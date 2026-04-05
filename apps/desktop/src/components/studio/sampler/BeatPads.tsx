import React, { useState, useCallback, useEffect, useRef } from 'react'
import { PadEngine } from './PadEngine'
import { Tooltip } from '../../shared'

const PAD_LABELS = [
  'C3','C#3','D3','D#3',
  'E3','F3','F#3','G3',
  'G#3','A3','A#3','B3',
  'C4','C#4','D4','D#4',
]

export default function BeatPads() {
  const ctxRef = useRef<AudioContext | null>(null)
  const engineRef = useRef<PadEngine | null>(null)
  const [slots, setSlots] = useState<{ fileName: string }[]>(
    Array.from({ length: 16 }, () => ({ fileName: '' }))
  )
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const flashTimers = useRef<Map<number, number>>(new Map())

  useEffect(() => {
    const ctx = new AudioContext()
    const engine = new PadEngine(ctx)
    engine.setOnSlotsChange(() => {
      setSlots(engine.getSlots().map(s => ({ fileName: s.fileName })))
    })
    ctxRef.current = ctx
    engineRef.current = engine
    return () => { engine.dispose(); ctx.close() }
  }, [])

  const triggerPad = useCallback((idx: number) => {
    if (ctxRef.current?.state === 'suspended') ctxRef.current.resume()
    engineRef.current?.trigger(idx)
    setActiveIdx(idx)
    const prev = flashTimers.current.get(idx)
    if (prev) clearTimeout(prev)
    const timer = window.setTimeout(() => {
      setActiveIdx(prev => prev === idx ? null : prev)
      flashTimers.current.delete(idx)
    }, 150)
    flashTimers.current.set(idx, timer)
  }, [])

  const assignSample = useCallback(async (idx: number) => {
    const filePath = await window.studioApi?.openSampleDialog()
    if (!filePath) return
    const data = await window.studioApi?.readAudioFile(filePath)
    if (!data) return
    await engineRef.current?.assignSample(idx, data, filePath.split(/[/\\]/).pop() || '')
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent, idx: number) => {
    e.preventDefault()
    assignSample(idx)
  }, [assignSample])

  return (
    <div className="beat-pads">
      <div className="beat-pads__header">
        <span className="panel-label">BEAT PADS</span>
        <span className="beat-pads__hint">Click = trigger | Right-click = assign sample</span>
      </div>
      <Tooltip text="BEAT PAD GRID" detail="Right-click a pad to assign a sample. Click to trigger it.">
      <div className="beat-pads__grid">
        {Array.from({ length: 16 }, (_, i) => {
          const hasFile = slots[i]?.fileName !== ''
          const isActive = activeIdx === i
          return (
            <button
              key={i}
              className={`beat-pad ${isActive ? 'beat-pad--active' : ''} ${hasFile ? 'beat-pad--loaded' : ''}`}
              onClick={() => triggerPad(i)}
              onContextMenu={e => handleContextMenu(e, i)}
              title={
                hasFile
                  ? `${PAD_LABELS[i]}: ${slots[i].fileName}\nRight-click to reassign`
                  : `${PAD_LABELS[i]}: Empty\nRight-click to assign a sample`
              }
            >
              <span className="beat-pad__label">{PAD_LABELS[i]}</span>
              <span className="beat-pad__file">
                {hasFile ? slots[i].fileName : '---'}
              </span>
            </button>
          )
        })}
      </div>
      </Tooltip>
    </div>
  )
}
