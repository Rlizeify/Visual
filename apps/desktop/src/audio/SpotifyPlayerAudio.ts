/** Audio routing for the Spotify Web Playback SDK.
 *  Taps the hidden <audio> element the SDK creates and routes it through
 *  a Web Audio AnalyserNode so the visualizer reacts to Spotify playback. */

let _analyser: AnalyserNode | null = null
let _audioCtx: AudioContext | null = null
let _sourceNode: MediaElementAudioSourceNode | null = null

export function connectToAnalyser(audioCtx: AudioContext): AnalyserNode {
  if (_analyser) return _analyser

  _audioCtx = audioCtx
  _analyser = audioCtx.createAnalyser()
  _analyser.fftSize = 2048

  tryConnectImmediate()
  watchForAudioElement()

  return _analyser
}

export function getAnalyserNode(): AnalyserNode | null {
  return _analyser
}

function tryConnectImmediate(): void {
  const el = document.querySelector('audio') as HTMLAudioElement | null
  if (el) connectElement(el)
}

function watchForAudioElement(): void {
  const observer = new MutationObserver(() => {
    const el =
      (document.querySelector('audio[src*="scdn"]') as HTMLAudioElement | null) ??
      (document.querySelector('audio') as HTMLAudioElement | null)
    if (el) {
      connectElement(el)
      observer.disconnect()
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

function connectElement(el: HTMLAudioElement): void {
  if (!_audioCtx || !_analyser || _sourceNode) return
  try {
    _sourceNode = _audioCtx.createMediaElementSource(el)
    _sourceNode.connect(_analyser)
    _analyser.connect(_audioCtx.destination)
    console.log('[SPOTIFY] Audio element connected to analyser')
  } catch (e) {
    console.warn('[SPOTIFY] Could not tap audio element:', e)
  }
}

export function resetAudioRouting(): void {
  _sourceNode = null
  _analyser = null
  _audioCtx = null
}
