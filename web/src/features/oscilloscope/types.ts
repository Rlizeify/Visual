export interface OsciSettings {
  freqX: number
  freqY: number
  phase: number
  thickness: number
  persistence: number
  spin: number
  beatKick: number
  color: string
}

export const OSCI_DEFAULTS: OsciSettings = {
  freqX: 3,
  freqY: 2,
  phase: 0,
  thickness: 2,
  persistence: 0.15,
  spin: 0.3,
  beatKick: 45,
  color: '#27e0e1',
}

export const OSCI_COLORS = ['#27e0e1', '#eea91c', '#7a0105', '#ffffff', '#ff2d78']
