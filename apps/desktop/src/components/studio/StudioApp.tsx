import React, { useState, useCallback, useEffect, useRef } from 'react'
import { synthEngine } from '../../audio/SynthEngine'
import { Oscilloscope, Tooltip } from '../shared'
import WaveformPanel from '../cockpit/WaveformPanel'

type OscMode = 'TIME' | 'XY' | 'XYZ'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Wave {
  id: string
  type: 'sine' | 'square' | 'sawtooth' | 'triangle'
  frequency: number
  amplitude: number
}

interface PatchEffects {
  weight: number
  texture: number
  brightness: number
  speed: number
}

interface Patch {
  id: string
  name: string
  color: string
  waves: Wave[]
  effects: PatchEffects
  muted: boolean
  solo: boolean
  volume: number
  active: boolean
}

interface Session {
  name: string
  bpm: number
  patches: Patch[]
}

declare global {
  interface Window {
    studioApi?: {
      saveSession: (data: string) => Promise<string | null>
      discardSession: () => void
      markDirty: () => void
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PATCH_COLORS = ['#ffb347', '#ff6b9d', '#00ffcc', '#b06cff']
let patchCounter = 0

function createPatch(): Patch {
  const idx = patchCounter++
  return {
    id: crypto.randomUUID(),
    name: `Patch ${idx + 1}`,
    color: PATCH_COLORS[idx % PATCH_COLORS.length],
    waves: [],
    effects: { weight: 50, texture: 50, brightness: 50, speed: 50 },
    muted: false,
    solo: false,
    volume: 80,
    active: false,
  }
}

function createDefaultSession(): Session {
  return { name: 'Untitled Session', bpm: 120, patches: [createPatch()] }
}

// ─── StudioApp ───────────────────────────────────────────────────────────────

export default function StudioApp() {
  const [session, setSession] = useState<Session>(createDefaultSession)
  const [isDirty, setIsDirty] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [selectedPatchId, setSelectedPatchId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [masterVolume, setMasterVolume] = useState(80)
  const [tapTimes, setTapTimes] = useState<number[]>([])
  const nameInputRef = useRef<HTMLInputElement>(null)
  const closeActionRef = useRef<'save' | 'discard' | null>(null)

  // ── Oscilloscope state ──────────────────────────────────────────────────
  const [oscMode, setOscMode] = useState<OscMode>('TIME')
  const [waveAssign, setWaveAssign] = useState<{ x: string | null; y: string | null; z: string | null }>({ x: null, y: null, z: null })
  const [autoAssign, setAutoAssign] = useState(true)
  const timeDomainRef = useRef<Float32Array>(new Float32Array(256))
  const waveDataRefs = useRef<Record<string, Float32Array>>({})
  const [frameCounter, setFrameCounter] = useState(0)
  const rafRef = useRef<number>(0)
  const [activeWaveIds, setActiveWaveIds] = useState<string[]>([])
  const [activeWaveInfo, setActiveWaveInfo] = useState<Array<{ id: string; type: string; frequency: number }>>([])

  // Mark dirty on any session change
  const updateSession = useCallback((updater: (s: Session) => Session) => {
    setSession(prev => {
      const next = updater(prev)
      setIsDirty(true)
      window.studioApi?.markDirty()
      return next
    })
  }, [])

  // Beforeunload guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        setShowModal(true)
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // ── Oscilloscope rAF loop ──────────────────────────────────────────────
  useEffect(() => {
    let running = true
    const loop = () => {
      if (!running) return
      const ids = synthEngine.getActiveWaveIds()
      setActiveWaveIds(ids)
      if (ids.length > 0) {
        timeDomainRef.current = synthEngine.getTimeDomainData()
        const newData: Record<string, Float32Array> = {}
        for (const id of ids) {
          newData[id] = synthEngine.getWaveTimeDomain(id)
        }
        waveDataRefs.current = newData
        setActiveWaveInfo(synthEngine.getOscillators().map(o => ({ id: o.id, type: o.type, frequency: o.frequency })))
        setFrameCounter(c => c + 1)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { running = false; cancelAnimationFrame(rafRef.current) }
  }, [isPlaying])

  // Auto-assign waves to XYZ by frequency
  useEffect(() => {
    if (!autoAssign || activeWaveInfo.length === 0) return
    const sorted = [...activeWaveInfo].sort((a, b) => a.frequency - b.frequency)
    setWaveAssign({
      x: sorted[0]?.id ?? null,
      y: sorted[Math.min(1, sorted.length - 1)]?.id ?? null,
      z: sorted[Math.min(2, sorted.length - 1)]?.id ?? null,
    })
  }, [autoAssign, activeWaveInfo.length, frameCounter])

  // Save session
  const handleSave = useCallback(async () => {
    const json = JSON.stringify({
      name: session.name,
      bpm: session.bpm,
      patches: session.patches.map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        waves: p.waves,
        effects: p.effects,
      })),
    }, null, 2)
    const result = await window.studioApi?.saveSession(json)
    if (result) {
      setIsDirty(false)
      if (closeActionRef.current === 'save') {
        window.close()
      }
    }
    setShowModal(false)
    closeActionRef.current = null
  }, [session])

  // Discard
  const handleDiscard = useCallback(() => {
    setShowModal(false)
    setIsDirty(false)
    closeActionRef.current = null
    window.studioApi?.discardSession()
    window.close()
  }, [])

  // Modal save (from close attempt)
  const handleModalSave = useCallback(() => {
    closeActionRef.current = 'save'
    handleSave()
  }, [handleSave])

  const handleModalDiscard = useCallback(() => {
    closeActionRef.current = 'discard'
    handleDiscard()
  }, [handleDiscard])

  // Add patch
  const addPatch = useCallback(() => {
    updateSession(s => ({ ...s, patches: [...s.patches, createPatch()] }))
  }, [updateSession])

  // Toggle mute
  const toggleMute = useCallback((id: string) => {
    updateSession(s => ({
      ...s,
      patches: s.patches.map(p => p.id === id ? { ...p, muted: !p.muted } : p),
    }))
  }, [updateSession])

  // Toggle solo
  const toggleSolo = useCallback((id: string) => {
    updateSession(s => ({
      ...s,
      patches: s.patches.map(p => p.id === id ? { ...p, solo: !p.solo } : p),
    }))
  }, [updateSession])

  // Patch volume
  const setPatchVolume = useCallback((id: string, volume: number) => {
    updateSession(s => ({
      ...s,
      patches: s.patches.map(p => p.id === id ? { ...p, volume } : p),
    }))
  }, [updateSession])

  // Tap BPM
  const handleTapBPM = useCallback(() => {
    const now = performance.now()
    setTapTimes(prev => {
      const times = [...prev, now].filter(t => now - t < 3000)
      if (times.length >= 2) {
        const intervals = times.slice(1).map((t, i) => t - times[i])
        const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length
        const bpm = Math.round(60000 / avgMs)
        if (bpm >= 30 && bpm <= 300) {
          updateSession(s => ({ ...s, bpm }))
        }
      }
      return times
    })
  }, [updateSession])

  // Session name editing
  const startEditName = useCallback(() => {
    setEditingName(true)
    setTimeout(() => nameInputRef.current?.select(), 10)
  }, [])

  const finishEditName = useCallback((value: string) => {
    setEditingName(false)
    if (value.trim()) {
      updateSession(s => ({ ...s, name: value.trim() }))
    }
  }, [updateSession])

  // New session
  const handleNew = useCallback(() => {
    if (isDirty) {
      setShowModal(true)
      return
    }
    patchCounter = 0
    setSession(createDefaultSession())
    setIsDirty(false)
    setSelectedPatchId(null)
  }, [isDirty])

  return (
    <div className="studio-frame">
      {/* ─── TOP BAR ─────────────────────────────────────────────────────── */}
      <div className="studio-top-bar panel">
        <div className="studio-top-bar__left">
          <span className="studio-logo">STUDIO</span>
        </div>
        <div className="studio-top-bar__center">
          {editingName ? (
            <input
              ref={nameInputRef}
              className="studio-session-name-input"
              defaultValue={session.name}
              onBlur={e => finishEditName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') finishEditName((e.target as HTMLInputElement).value)
                if (e.key === 'Escape') setEditingName(false)
              }}
              autoFocus
            />
          ) : (
            <span className="studio-session-name" onClick={startEditName}>
              {session.name}
              {isDirty && <span className="studio-dirty-dot" />}
            </span>
          )}
        </div>
        <div className="studio-top-bar__right">
          <button className="studio-btn studio-btn--amber" onClick={handleSave}>SAVE</button>
          <button className="studio-btn studio-btn--red" onClick={handleNew}>NEW</button>
          <div className="studio-bpm-display">
            <span className="studio-bpm-label">BPM</span>
            <span className="studio-bpm-value">{session.bpm}</span>
          </div>
          <button className="studio-btn studio-btn--teal studio-btn--small" onClick={handleTapBPM}>
            TAP
          </button>
        </div>
      </div>

      {/* ─── BODY ────────────────────────────────────────────────────────── */}
      <div className="studio-body">
        {/* PATCH RACK */}
        <div className="studio-patch-rack panel">
          <div className="studio-patch-rack__header">
            <span className="panel-label">PATCHES</span>
          </div>
          <div className="studio-patch-rack__list">
            {session.patches.map(patch => (
              <div
                key={patch.id}
                className={`studio-patch-slot ${selectedPatchId === patch.id ? 'selected' : ''}`}
                style={{
                  borderLeftColor: selectedPatchId === patch.id ? '#ff2d9b' : patch.color,
                  background: selectedPatchId === patch.id ? 'rgba(255,45,155,0.08)' : undefined,
                  boxShadow: selectedPatchId === patch.id ? '0 0 8px rgba(255,45,155,0.25)' : undefined,
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedPatchId(patch.id)}
              >
                <div className="studio-patch-slot__top">
                  <span className="studio-patch-slot__name">{patch.name}</span>
                  <span
                    className={`studio-patch-slot__indicator ${patch.active ? 'active' : ''}`}
                    style={{ backgroundColor: patch.active ? patch.color : undefined }}
                  />
                </div>
                <div className="studio-patch-slot__info">
                  <span className="studio-patch-slot__waves">{patch.waves.length} waves</span>
                </div>
                <div className="studio-patch-slot__controls">
                  <button
                    className={`studio-patch-btn ${patch.muted ? 'active' : ''}`}
                    title="MUTE — Silence this patch without removing it"
                    onClick={e => { e.stopPropagation(); toggleMute(patch.id) }}
                  >M</button>
                  <button
                    className={`studio-patch-btn ${patch.solo ? 'active' : ''}`}
                    title="SOLO — Play only this patch, mute all others"
                    onClick={e => { e.stopPropagation(); toggleSolo(patch.id) }}
                  >S</button>
                  <input
                    type="range"
                    className="studio-patch-volume"
                    min={0}
                    max={100}
                    value={patch.volume}
                    onChange={e => { e.stopPropagation(); setPatchVolume(patch.id, Number(e.target.value)) }}
                    onClick={e => e.stopPropagation()}
                  />
                </div>
              </div>
            ))}
          </div>
          <button className="studio-add-patch" onClick={addPatch}>+ ADD PATCH</button>
        </div>

        {/* MAIN CANVAS */}
        <div className="studio-main-canvas panel" style={{ display: 'flex', flexDirection: 'column' }}>
          {/* ── TOP 55%: OSCILLOSCOPE ─────────────────────────────────── */}
          <div style={{ flex: '0 0 55%', display: 'flex', flexDirection: 'column', borderBottom: '1px solid rgba(255,45,155,0.2)' }}>
            {/* Mode bar */}
            <div style={{
              height: 32, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px',
              borderBottom: '1px solid rgba(255,45,155,0.15)',
            }}>
              {(['TIME', 'XY', 'XYZ'] as OscMode[]).map(mode => (
                <Tooltip
                  key={mode}
                  text={`${mode} MODE`}
                  detail={
                    mode === 'TIME' ? 'Composite waveform of all active synth waves' :
                    mode === 'XY' ? 'Plot one wave against another — creates Lissajous shapes' :
                    '3D parametric curve. Assign three waves to X/Y/Z axes. Drag to rotate.'
                  }
                >
                  <button
                    onClick={() => setOscMode(mode)}
                    style={{
                      fontFamily: 'Orbitron, monospace', fontSize: 10, fontWeight: 700,
                      padding: '2px 10px', border: '1px solid',
                      borderColor: oscMode === mode ? '#ff2d9b' : 'rgba(255,45,155,0.3)',
                      background: oscMode === mode ? 'rgba(255,45,155,0.2)' : 'transparent',
                      color: oscMode === mode ? '#ff2d9b' : 'rgba(255,45,155,0.5)',
                      cursor: 'pointer', borderRadius: 2, letterSpacing: 1,
                    }}
                  >
                    {mode}
                  </button>
                </Tooltip>
              ))}

              {(oscMode === 'XY' || oscMode === 'XYZ') && (
                <div style={{ display: 'flex', gap: 6, marginLeft: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Tooltip text="AUTO ASSIGN" detail="Automatically assigns waves to axes by frequency — lowest to X, mid to Y, highest to Z">
                    <button
                      onClick={() => setAutoAssign(a => !a)}
                      style={{
                        fontFamily: 'Orbitron, monospace', fontSize: 9, fontWeight: 700,
                        padding: '2px 8px', border: '1px solid',
                        borderColor: autoAssign ? '#00ffcc' : 'rgba(0,255,204,0.3)',
                        background: autoAssign ? 'rgba(0,255,204,0.15)' : 'transparent',
                        color: autoAssign ? '#00ffcc' : 'rgba(0,255,204,0.5)',
                        cursor: 'pointer', borderRadius: 2, letterSpacing: 1,
                      }}
                    >
                      AUTO
                    </button>
                  </Tooltip>
                  {activeWaveInfo.map(w => {
                    const axis = waveAssign.x === w.id ? 'X' : waveAssign.y === w.id ? 'Y' : waveAssign.z === w.id ? 'Z' : null
                    const dotColor = axis === 'X' ? '#ff4444' : axis === 'Y' ? '#44ff44' : axis === 'Z' ? '#4488ff' : 'transparent'
                    return (
                      <button
                        key={w.id}
                        onClick={() => {
                          if (autoAssign) return
                          setWaveAssign(prev => {
                            const cleared = { ...prev }
                            if (cleared.x === w.id) cleared.x = null
                            if (cleared.y === w.id) cleared.y = null
                            if (cleared.z === w.id) cleared.z = null
                            if (!axis) cleared.x = w.id
                            else if (axis === 'X') cleared.y = w.id
                            else if (axis === 'Y') cleared.z = w.id
                            // Z → unassigned (already cleared)
                            return cleared
                          })
                        }}
                        style={{
                          fontFamily: 'Orbitron, monospace', fontSize: 8, padding: '2px 8px',
                          border: '1px solid rgba(255,45,155,0.3)', background: 'rgba(255,45,155,0.08)',
                          color: '#ff2d9b', cursor: autoAssign ? 'default' : 'pointer', borderRadius: 10,
                          display: 'flex', alignItems: 'center', gap: 4, opacity: autoAssign ? 0.6 : 1,
                        }}
                      >
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%', background: dotColor,
                          display: 'inline-block', flexShrink: 0,
                        }} />
                        {w.type.toUpperCase()} {Math.round(w.frequency)}hz
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Oscilloscope display */}
            <div style={{ flex: 1, minHeight: 0 }}>
              <Oscilloscope
                mode={oscMode}
                timeData={oscMode === 'TIME' ? timeDomainRef.current : undefined}
                xData={oscMode === 'XY' && waveAssign.x ? waveDataRefs.current[waveAssign.x] : undefined}
                yData={oscMode === 'XY' && waveAssign.y ? waveDataRefs.current[waveAssign.y] : undefined}
                xData3={oscMode === 'XYZ' && waveAssign.x ? waveDataRefs.current[waveAssign.x] : undefined}
                yData3={oscMode === 'XYZ' && waveAssign.y ? waveDataRefs.current[waveAssign.y] : undefined}
                zData3={oscMode === 'XYZ' && waveAssign.z ? waveDataRefs.current[waveAssign.z] : undefined}
                color="#ff2d9b"
                glowColor="rgba(255,45,155,0.35)"
                showGrid={true}
                autoRotate={true}
                onModeChange={(m: OscMode) => setOscMode(m)}
              />
            </div>
          </div>

          {/* ── BOTTOM 45%: WAVE EDITOR ────────────────────────── */}
          <div style={{
            flex: '0 0 45%', display: 'flex', flexDirection: 'column',
            background: 'rgba(0,0,0,0.3)', overflow: 'hidden',
          }}>
            {selectedPatchId ? (
              <>
                <div style={{
                  padding: '4px 10px', borderBottom: '1px solid rgba(255,45,155,0.15)',
                  fontFamily: 'Orbitron, monospace', fontSize: 10, fontWeight: 700,
                  color: '#ff2d9b', letterSpacing: 2,
                }}>
                  EDITING: {session.patches.find(p => p.id === selectedPatchId)?.name ?? 'PATCH'}
                </div>
                <div style={{ flex: 1, minHeight: 0 }}>
                  <WaveformPanel />
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{
                  fontFamily: 'Orbitron, monospace', fontSize: 12, color: 'rgba(255,45,155,0.4)',
                  letterSpacing: 2,
                }}>
                  SELECT A PATCH TO EDIT
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── BOTTOM BAR ──────────────────────────────────────────────────── */}
      <div className="studio-bottom-bar panel">
        <div className="studio-bottom-bar__transport">
          <button
            className={`studio-btn studio-btn--amber ${isPlaying ? 'active' : ''}`}
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? 'STOP ALL' : 'PLAY ALL'}
          </button>
          <button
            className={`studio-btn studio-btn--red studio-btn--small ${isRecording ? 'active' : ''}`}
            onClick={() => setIsRecording(!isRecording)}
          >
            REC
          </button>
        </div>
        <div className="studio-bottom-bar__master">
          <span className="studio-master-label">MASTER</span>
          <input
            type="range"
            className="studio-master-slider"
            min={0}
            max={100}
            value={masterVolume}
            onChange={e => setMasterVolume(Number(e.target.value))}
          />
          <span className="studio-master-value">{masterVolume}</span>
        </div>
        <div className="studio-bottom-bar__export">
          <button className="studio-btn studio-btn--teal">EXPORT SESSION</button>
        </div>
      </div>

      {/* ─── UNSAVED CHANGES MODAL ───────────────────────────────────────── */}
      {showModal && (
        <div className="studio-modal-overlay">
          <div className="studio-modal panel">
            <h2 className="studio-modal__title">UNSAVED CHANGES</h2>
            <p className="studio-modal__text">You have unsaved changes in this session.</p>
            <div className="studio-modal__actions">
              <button className="studio-btn studio-btn--amber" onClick={handleModalSave}>SAVE</button>
              <button className="studio-btn studio-btn--red" onClick={handleModalDiscard}>DISCARD</button>
              <button className="studio-btn studio-btn--dim" onClick={() => setShowModal(false)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
