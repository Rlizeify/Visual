import React, { useState, useCallback, useEffect, useRef } from 'react'
import { synthEngine } from '../../audio/SynthEngine'
import { Tooltip } from '../shared'
import LJVScope from '../oscilloscope/LJVScope'
import AdditiveSynth from './synth/AdditiveSynth'

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
              <Tooltip key={patch.id} text="PATCH" detail="Click to open this patch in the wave editor below">
              <div
                className={`studio-patch-slot ${selectedPatchId === patch.id ? 'selected' : ''}`}
                style={{
                  borderLeft: selectedPatchId === patch.id ? '3px solid #ff2d9b' : '3px solid rgba(255,45,155,0.2)',
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
              </Tooltip>
            ))}
          </div>
          <button className="studio-add-patch" onClick={addPatch}>+ ADD PATCH</button>
        </div>

        {/* MAIN CANVAS */}
        <div className="studio-main-canvas panel" style={{ display: 'flex', flexDirection: 'column' }}>
          {/* ── TOP 55%: OSCILLOSCOPE ─────────────────────────────────── */}
          <div style={{ flex: '0 0 55%', display: 'flex', flexDirection: 'column', borderBottom: '1px solid rgba(255,45,155,0.2)' }}>
            <LJVScope
              analyser={synthEngine.getAnalyserNode()}
              color="#ff2d9b"
              glowColor="rgba(255,45,155,0.35)"
            />
          </div>

          {/* ── BOTTOM 45%: ADDITIVE SYNTH ─────────────────────── */}
          <div style={{
            flex: '0 0 45%', display: 'flex', flexDirection: 'column',
            background: 'rgba(0,0,0,0.3)', overflow: 'hidden',
          }}>
            <AdditiveSynth />
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
