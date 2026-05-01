import React, { useState, useCallback, useEffect, useRef } from 'react'
import { synthEngine } from '../../audio/SynthEngine'
import { useProjectPersistence } from '../../hooks/useProjectPersistence'
import { Tooltip } from '../shared'
import SaveDialog from '../shared/SaveDialog'
import LoadDialog from '../shared/LoadDialog'
import LJVScope from '../oscilloscope/LJVScope'
import AdditiveSynth, { type AdditiveAudioRefs } from './synth/AdditiveSynth'
import XYScope from './synth/XYScope'
import FunctionSynth from './synth/FunctionSynth'
import SampleEditor from './sampler/SampleEditor'
import BeatPads from './sampler/BeatPads'
import { registerStudioState, getStudioState, setStudioState } from './studioStateCollector'
import StudioTutorial from './StudioTutorial'

type StudioTab = 'synth' | 'sampler'

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
      openSampleDialog: () => Promise<string | null>
      readAudioFile: (path: string) => Promise<ArrayBuffer | null>
      projectSave: (d: { name: string; state: Record<string, unknown> }) => Promise<unknown>
      projectLoad: (d: { id: number }) => Promise<unknown>
      projectList: () => Promise<unknown[]>
      projectDelete: (d: { id: number }) => Promise<boolean>
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
  const [showTutorial, setShowTutorial] = useState(false)
  const [session, setSession] = useState<Session>(createDefaultSession)
  const [isDirty, setIsDirty] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [selectedPatchId, setSelectedPatchId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [masterVolume, setMasterVolume] = useState(80)
  const [tapTimes, setTapTimes] = useState<number[]>([])
  const [activeTab, setActiveTab] = useState<StudioTab>('synth')
  const [additiveRefs, setAdditiveRefs] = useState<AdditiveAudioRefs | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const closeActionRef = useRef<'save' | 'discard' | null>(null)

  // Register studio state for persistence
  useEffect(() => {
    registerStudioState(
      () => ({
        sessionName: session.name, bpm: session.bpm, patches: session.patches,
        selectedPatchId, masterVolume, activeTab,
      }),
      (s) => {
        setSession({ name: s.sessionName, bpm: s.bpm, patches: s.patches as Patch[] })
        setSelectedPatchId(s.selectedPatchId)
        setMasterVolume(s.masterVolume)
        setActiveTab(s.activeTab as StudioTab)
        setIsDirty(false)
      }
    )
  })

  const studioApi = (window as any).studioApi
  const persistence = useProjectPersistence({
    api: studioApi, getState: getStudioState, setState: setStudioState,
  })

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

  // Save session (now uses project persistence)
  const handleSave = useCallback(async () => {
    persistence.quickSave()
    setIsDirty(false)
    if (closeActionRef.current === 'save') {
      window.close()
    }
    setShowModal(false)
    closeActionRef.current = null
  }, [persistence])

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
          <Tooltip text="SAVE" detail="Save the current session to disk">
          <button className="studio-btn studio-btn--amber" onClick={() => persistence.quickSave()}>SAVE</button>
          </Tooltip>
          <Tooltip text="NEW" detail="Create a new empty session">
          <button className="studio-btn studio-btn--red" onClick={handleNew}>NEW</button>
          </Tooltip>
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
        <div className="studio-patch-rack panel" data-tutorial-id="studio-patches">
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
        <div className="studio-main-canvas panel">
          {/* ── TAB SWITCHER ─────────────────────────────────────── */}
          <div className="studio-tab-bar" data-tutorial-id="studio-tabs">
            <button
              className={`studio-tab ${activeTab === 'synth' ? 'studio-tab--active' : ''}`}
              onClick={() => setActiveTab('synth')}
              title="Additive synthesizer and oscilloscope"
            >SYNTH</button>
            <button
              className={`studio-tab ${activeTab === 'sampler' ? 'studio-tab--active' : ''}`}
              onClick={() => setActiveTab('sampler')}
              title="Sample editor and beat pads"
            >SAMPLER</button>
          </div>

          {activeTab === 'synth' ? (
            <>
              {/* ── TOP 55%: WAVEFORM OSCILLOSCOPE ─────────────── */}
              <Tooltip text="OSCILLOSCOPE" detail="XY audio visualization — left channel vs right channel">
              <div data-tutorial-id="studio-oscilloscope" style={{ flex: '0 0 55%', minHeight: 0, display: 'flex', flexDirection: 'column', borderBottom: '1px solid rgba(255,45,155,0.2)', width: '100%' }}>
                <LJVScope
                  analyser={synthEngine.getAnalyserNode()}
                  color="#ff2d9b"
                  glowColor="rgba(255,45,155,0.35)"
                />
              </div>
              </Tooltip>
              {/* ── BOTTOM 45%: ADDITIVE SYNTH (65%) + XY SCOPE (35%) */}
              <div style={{
                flex: '1 1 45%', minHeight: 0, display: 'flex', flexDirection: 'row',
                background: 'rgba(0,0,0,0.3)', overflow: 'hidden',
              }}>
                {/* Additive synth — ~65% width */}
                <div data-tutorial-id="studio-additive-synth" style={{ flex: '0 0 65%', minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid #2a2a2a' }}>
                  <AdditiveSynth onEngineReady={setAdditiveRefs} />
                </div>
                {/* XY Oscilloscope + Function input — ~35% width */}
                <div style={{ flex: '1 1 35%', minWidth: 0, display: 'flex', flexDirection: 'column', background: '#0a0a0a' }}>
                  <div data-tutorial-id="studio-xy-scope" style={{ flex: 1, minHeight: 0 }}>
                    <XYScope analyser={additiveRefs?.analyser ?? null} />
                  </div>
                  <FunctionSynth
                    ctx={additiveRefs?.ctx ?? null}
                    destination={additiveRefs?.masterGain ?? null}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* ── TOP: SAMPLE EDITOR ───────────────────────────── */}
              <div data-tutorial-id="studio-sample-editor" style={{ flex: '0 0 50%', minHeight: 0, display: 'flex', flexDirection: 'column', borderBottom: '1px solid rgba(122,1,5,0.4)' }}>
                <SampleEditor />
              </div>
              {/* ── BOTTOM: BEAT PADS ────────────────────────────── */}
              <div data-tutorial-id="studio-beat-pads" style={{
                flex: '1 1 50%', minHeight: 0, display: 'flex', flexDirection: 'column',
                background: 'rgba(0,0,0,0.3)', overflow: 'hidden',
              }}>
                <BeatPads />
              </div>
            </>
          )}
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
        <span className={`project-status ${persistence.projectName !== 'Untitled' ? 'project-status--saved' : 'project-status--unsaved'}`}>
          {persistence.statusText}
        </span>
        <div className="studio-bottom-bar__export">
          <button className="studio-btn studio-btn--teal">EXPORT SESSION</button>
        </div>
        <button
          className="studio-help-btn"
          onClick={() => setShowTutorial(true)}
          aria-label="Open tutorial"
        >
          ?
        </button>
      </div>

      {/* TUTORIAL */}
      {showTutorial && <StudioTutorial onClose={() => setShowTutorial(false)} />}

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

      {/* SAVE/LOAD DIALOGS */}
      {persistence.showSave && (
        <SaveDialog defaultName={persistence.projectName}
          onSave={persistence.handleSave} onCancel={() => persistence.setShowSave(false)} />
      )}
      {persistence.showLoad && (
        <LoadDialog projects={persistence.projects}
          onLoad={persistence.handleLoad} onDelete={persistence.handleDelete}
          onCancel={() => persistence.setShowLoad(false)} />
      )}
      {persistence.showFlash && <div className="save-flash">SAVED</div>}
    </div>
  )
}
