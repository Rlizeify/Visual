/* studioStateCollector.ts — collect/restore serializable Studio state */

interface StudioSnapshot {
  sessionName: string
  bpm: number
  patches: unknown[]
  selectedPatchId: string | null
  masterVolume: number
  activeTab: string
}

type StudioGetter = () => StudioSnapshot
type StudioSetter = (s: StudioSnapshot) => void

let _studioGet: StudioGetter | null = null
let _studioSet: StudioSetter | null = null

export function registerStudioState(get: StudioGetter, set: StudioSetter) {
  _studioGet = get
  _studioSet = set
}

// ─── Sampler state ─────────────────────────────────────────────────────────

interface SamplerSnapshot {
  fileName: string | null
  startTime: number
  endTime: number
  loop: boolean
  pitchSemitones: number
  reversed: boolean
}

type SamplerGetter = () => SamplerSnapshot
type SamplerSetter = (s: SamplerSnapshot) => void

let _samplerGet: SamplerGetter | null = null
let _samplerSet: SamplerSetter | null = null

export function registerSamplerState(get: SamplerGetter, set: SamplerSetter) {
  _samplerGet = get
  _samplerSet = set
}

// ─── BeatPad state ─────────────────────────────────────────────────────────

interface PadSnapshot {
  index: number
  fileName: string | null
  volume: number
  pitch: number
}

type PadGetter = () => PadSnapshot[]
type PadSetter = (s: PadSnapshot[]) => void

let _padGet: PadGetter | null = null
let _padSet: PadSetter | null = null

export function registerPadState(get: PadGetter, set: PadSetter) {
  _padGet = get
  _padSet = set
}

// ─── Collect / Restore ─────────────────────────────────────────────────────

export function getStudioState(): Record<string, unknown> {
  const state: Record<string, unknown> = {}
  if (_studioGet) state.session = _studioGet()
  if (_samplerGet) state.sampler = _samplerGet()
  if (_padGet) state.beat_pads = _padGet()
  return state
}

export function setStudioState(state: Record<string, unknown>): void {
  if (state.session && _studioSet) _studioSet(state.session as StudioSnapshot)
  if (state.sampler && _samplerSet) _samplerSet(state.sampler as SamplerSnapshot)
  if (state.beat_pads && _padSet) _padSet(state.beat_pads as PadSnapshot[])
}
