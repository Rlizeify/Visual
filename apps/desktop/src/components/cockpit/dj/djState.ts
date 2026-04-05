/* djState.ts — DJ mixer state snapshot + restore */

export interface DeckState {
  id: 'A' | 'B' | 'C' | 'D'
  filePath: string | null
  fileName: string | null
  cuePoint: number
  hotCues: (number | null)[]
  pitch: number
  volume: number
  isPlaying: boolean
  currentTime: number
}

export interface DJState {
  decks: DeckState[]
  crossfader: number
  masterVolume: number
}

type StateGetter = () => DJState
type StateSetter = (s: DJState) => void

let _getter: StateGetter | null = null
let _setter: StateSetter | null = null

/** Register live getter/setter from DJDecks component */
export function registerDJStateHandlers(get: StateGetter, set: StateSetter) {
  _getter = get
  _setter = set
}

/** Read live DJ mixer state */
export function getDJState(): DJState {
  if (!_getter) throw new Error('DJ state not initialized')
  return _getter()
}

/** Restore DJ mixer state */
export function setDJState(state: DJState): void {
  if (!_setter) throw new Error('DJ state not initialized')
  _setter(state)
}

// Expose to console for verification
if (typeof window !== 'undefined') {
  (window as any).getDJState = getDJState;
  (window as any).setDJState = setDJState
}
