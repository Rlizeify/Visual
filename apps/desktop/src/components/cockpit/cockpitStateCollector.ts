/* cockpitStateCollector.ts — collect/restore serializable Cockpit state */

// ─── Cockpit component state (set by CockpitApp via register) ──────────────

interface CockpitUIState {
  volume: number
  selectedPreset: string
  blendTime: number
  cycleSpeed: number
  bassReactivity: number
  midReactivity: number
  highReactivity: number
  animationSpeed: number
}

type UIGetter = () => CockpitUIState
type UISetter = (s: CockpitUIState) => void

let _uiGet: UIGetter | null = null
let _uiSet: UISetter | null = null

export function registerCockpitUI(get: UIGetter, set: UISetter) {
  _uiGet = get
  _uiSet = set
}

// ─── Plugin state (set by PluginRack via register) ─────────────────────────

interface PluginSnapshot {
  name: string
  bypassed: boolean
  params: Record<string, number>
}

type PluginGetter = () => PluginSnapshot[]
type PluginSetter = (s: PluginSnapshot[]) => void

let _pluginGet: PluginGetter | null = null
let _pluginSet: PluginSetter | null = null

export function registerPluginState(get: PluginGetter, set: PluginSetter) {
  _pluginGet = get
  _pluginSet = set
}

// ─── Video state ───────────────────────────────────────────────────────────

import { getVideoFiles } from './useVideoStore'

// ─── Collect / Restore ─────────────────────────────────────────────────────

export function getCockpitState(): Record<string, unknown> {
  const state: Record<string, unknown> = {}

  // Cockpit UI
  if (_uiGet) state.cockpit_ui = _uiGet()

  // Plugins
  if (_pluginGet) state.plugins = _pluginGet()

  // Video media library references
  try {
    const videoFiles = getVideoFiles()
    state.video_media = videoFiles
      .filter(f => f.dbId != null)
      .map(f => ({ dbId: f.dbId, path: f.path, name: f.name }))
  } catch { /* not initialized */ }

  return state
}

export function setCockpitState(state: Record<string, unknown>): void {
  // Cockpit UI
  if (state.cockpit_ui && _uiSet) {
    _uiSet(state.cockpit_ui as CockpitUIState)
  }

  // Plugins
  if (state.plugins && _pluginSet) {
    _pluginSet(state.plugins as PluginSnapshot[])
  }
}
