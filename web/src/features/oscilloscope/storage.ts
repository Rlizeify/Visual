import { OSCI_DEFAULTS, type OsciSettings } from './types'

const OSCI_STORAGE_KEY = 'mheu_osci_settings'

export function loadOsciSettings(): OsciSettings {
  try {
    const raw = localStorage.getItem(OSCI_STORAGE_KEY)
    if (!raw) return { ...OSCI_DEFAULTS }
    const p = JSON.parse(raw)
    if (!p || typeof p !== 'object') return { ...OSCI_DEFAULTS }
    return {
      freqX:       typeof p.freqX       === 'number' ? p.freqX       : OSCI_DEFAULTS.freqX,
      freqY:       typeof p.freqY       === 'number' ? p.freqY       : OSCI_DEFAULTS.freqY,
      phase:       typeof p.phase       === 'number' ? p.phase       : OSCI_DEFAULTS.phase,
      thickness:   typeof p.thickness   === 'number' ? p.thickness   : OSCI_DEFAULTS.thickness,
      persistence: typeof p.persistence === 'number' ? p.persistence : OSCI_DEFAULTS.persistence,
      spin:        typeof p.spin        === 'number' ? p.spin        : OSCI_DEFAULTS.spin,
      beatKick:    typeof p.beatKick    === 'number' ? p.beatKick    : OSCI_DEFAULTS.beatKick,
      color:       typeof p.color       === 'string' ? p.color       : OSCI_DEFAULTS.color,
    }
  } catch {
    return { ...OSCI_DEFAULTS }
  }
}

export function saveOsciSettings(s: OsciSettings): void {
  try {
    localStorage.setItem(OSCI_STORAGE_KEY, JSON.stringify(s))
  } catch {
    // silently ignore
  }
}
