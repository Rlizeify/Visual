// Read-only accessor for the engine's shared AnalyserNode.
// Centralises the cross-feature import so audio consumers (waveform sampler,
// signal meter, T3) don't reach into the visualizer module directly.

import { getVisualizerEngine } from '../features/visualizer/VisualizerEngine'

export function getLiveAnalyser(): AnalyserNode | null {
  return getVisualizerEngine().getSharedAnalyser()
}
