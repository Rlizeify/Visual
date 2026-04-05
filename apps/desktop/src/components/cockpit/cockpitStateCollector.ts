/* cockpitStateCollector.ts — collect/restore serializable Cockpit state */

import { getDJState, setDJState } from './dj/djState'
import type { DJState } from './dj/djState'

// ─── Cockpit component state (set by CockpitApp via register) ──────────────

interface CockpitUIState {
  volume: number
  selectedPreset: string
  blendTime: number
  cycleSpeed: number
  bassReactivity: number
  midReactivity: number
  highReactivity: number
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

export { } // ensure this is a module

// ─── Collect / Restore ─────────────────────────────────────────────────────

export function getCockpitState(): Record<string, unknown> {
  const state: Record<string, unknown> = {}

  // DJ decks
  try { state.dj_decks = getDJState() } catch { /* not initialized */ }

  // Cockpit UI
  if (_uiGet) state.cockpit_ui = _uiGet()

  // Plugins
  if (_pluginGet) state.plugins = _pluginGet()

  return state
}

export function setCockpitState(state: Record<string, unknown>): void {
  // DJ decks
  if (state.dj_decks) {
    try { setDJState(state.dj_decks as DJState) } catch { /* not initialized */ }
  }

  // Cockpit UI
  if (state.cockpit_ui && _uiSet) {
    _uiSet(state.cockpit_ui as CockpitUIState)
  }

  // Plugins
  if (state.plugins && _pluginSet) {
    _pluginSet(state.plugins as PluginSnapshot[])
  }
}
