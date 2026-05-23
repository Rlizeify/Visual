import { useState } from 'react'
import { getVisualizerEngine, type VisualizerSettings } from './VisualizerEngine'
import { postServerSettings } from '../../services/spotify/session'

const VIZ_STORAGE_KEY = 'mheu_viz_settings'
type VizMode = 'viz' | 'scope'

const DEFAULT_SETTINGS: VisualizerSettings = {
  animationSpeed: 1,
  blendTime:      2.5,
  cycleSpeed:     15,
}

const NUM_KEYS: (keyof VisualizerSettings)[] = [
  'animationSpeed', 'blendTime', 'cycleSpeed',
]

function loadVizSettingsRaw(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(VIZ_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function saveVizSettingsRaw(data: Record<string, unknown>): void {
  try {
    const prev = loadVizSettingsRaw()
    localStorage.setItem(VIZ_STORAGE_KEY, JSON.stringify({ ...prev, ...data }))
  } catch {
    // Private browsing or storage full — silently ignore
  }
}

export interface UseVizSettings {
  settings: VisualizerSettings
  selectedPreset: string
  vizMode: VizMode
  updateSettings: (patch: Partial<VisualizerSettings>) => void
  setPreset: (preset: string) => void
  setVizMode: (mode: VizMode) => void
  applyServerSettings: (data: Record<string, unknown>) => void
  applyPersistedToEngine: (enginePreset: string) => void
}

export function useVizSettings(): UseVizSettings {
  const [settings, setSettings] = useState<VisualizerSettings>(() => {
    const s = loadVizSettingsRaw()
    return {
      animationSpeed: typeof s.animationSpeed === 'number' ? s.animationSpeed : DEFAULT_SETTINGS.animationSpeed,
      blendTime:      typeof s.blendTime      === 'number' ? s.blendTime      : DEFAULT_SETTINGS.blendTime,
      cycleSpeed:     typeof s.cycleSpeed     === 'number' ? s.cycleSpeed     : DEFAULT_SETTINGS.cycleSpeed,
    }
  })
  const [selectedPreset, setSelectedPreset] = useState<string>(() => {
    const s = loadVizSettingsRaw()
    return typeof s.selectedPreset === 'string' ? s.selectedPreset : ''
  })
  const [vizMode, setVizMode] = useState<VizMode>(() => {
    const s = loadVizSettingsRaw()
    return s.viz_mode === 'scope' ? 'scope' : 'viz'
  })

  function persist(blob: Record<string, unknown>) {
    saveVizSettingsRaw(blob)
    postServerSettings(blob)
  }

  const updateSettings = (patch: Partial<VisualizerSettings>) => {
    const updated = { ...settings, ...patch }
    setSettings(updated)
    getVisualizerEngine().updateSettings(patch)
    persist({ ...updated, selectedPreset, viz_mode: vizMode })
  }

  const setPreset = (preset: string) => {
    setSelectedPreset(preset)
    getVisualizerEngine().loadPreset(preset)
    persist({ ...settings, selectedPreset: preset, viz_mode: vizMode })
  }

  const setVizModeAndPersist = (mode: VizMode) => {
    setVizMode(mode)
    persist({ ...settings, selectedPreset, viz_mode: mode })
  }

  const applyServerSettings = (data: Record<string, unknown>) => {
    const patch: Partial<VisualizerSettings> = {}
    for (const k of NUM_KEYS) {
      if (typeof data[k] === 'number') patch[k] = data[k] as number
    }
    if (Object.keys(patch).length > 0) {
      setSettings(prev => ({ ...prev, ...patch }))
      getVisualizerEngine().updateSettings(patch)
    }
    if (typeof data.selectedPreset === 'string' && data.selectedPreset) {
      setSelectedPreset(data.selectedPreset)
      getVisualizerEngine().loadPreset(data.selectedPreset)
    }
    if (data.viz_mode === 'scope' || data.viz_mode === 'viz') {
      setVizMode(data.viz_mode)
    }
    try {
      const prev = JSON.parse(localStorage.getItem(VIZ_STORAGE_KEY) || '{}')
      localStorage.setItem(VIZ_STORAGE_KEY, JSON.stringify({ ...prev, ...data }))
    } catch { /* storage full */ }
  }

  const applyPersistedToEngine = (enginePreset: string) => {
    const stored = loadVizSettingsRaw()
    const eng    = getVisualizerEngine()
    const storedPreset = typeof stored.selectedPreset === 'string' && stored.selectedPreset
    setSelectedPreset(storedPreset || enginePreset)
    if (storedPreset) eng.loadPreset(storedPreset)
    const patch: Partial<VisualizerSettings> = {}
    for (const k of NUM_KEYS) {
      if (typeof stored[k] === 'number') patch[k] = stored[k] as number
    }
    if (Object.keys(patch).length > 0) eng.updateSettings(patch)
  }

  return {
    settings,
    selectedPreset,
    vizMode,
    updateSettings,
    setPreset,
    setVizMode: setVizModeAndPersist,
    applyServerSettings,
    applyPersistedToEngine,
  }
}
