/** Audio routing for Spotify visualizer.
 *
 *  getUserMedia with chromeMediaSource:'desktop' crashes Electron renderer
 *  (bad IPC message reason 263) because it requires a valid desktopCapturer
 *  sourceId first.  For now we use a silent oscillator so the audio graph
 *  stays intact without crashing.
 *
 *  TODO: implement real WASAPI loopback once Visual Studio Build Tools are available
 */

let _analyser: AnalyserNode | null = null
let _oscillator: OscillatorNode | null = null
let _gainNode: GainNode | null = null
let _running = false

export function connectToAnalyser(audioCtx: AudioContext): AnalyserNode {
  if (_analyser) return _analyser
  _analyser = audioCtx.createAnalyser()
  _analyser.fftSize = 2048
  return _analyser
}

export async function startLoopback(audioCtx: AudioContext): Promise<void> {
  if (_running) return
  const analyser = connectToAnalyser(audioCtx)

  // Silent oscillator — keeps the audio graph alive with zero output
  _gainNode = audioCtx.createGain()
  _gainNode.gain.value = 0

  _oscillator = audioCtx.createOscillator()
  _oscillator.frequency.value = 440
  _oscillator.connect(_gainNode)
  _gainNode.connect(analyser)
  _oscillator.start()

  _running = true
}

export function stopLoopback(): void {
  if (_oscillator) { try { _oscillator.stop() } catch { /* already stopped */ } ; _oscillator = null }
  if (_gainNode)     { _gainNode.disconnect(); _gainNode = null }
  _running = false
}

export function getAnalyserNode(): AnalyserNode | null { return _analyser }

export function resetAudioRouting(): void {
  stopLoopback()
  _analyser = null
}
