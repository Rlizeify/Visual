/** Audio routing for Spotify visualizer.
 *
 *  Uses getDisplayMedia({ audio: true }) which, paired with the main process
 *  setDisplayMediaRequestHandler({ audio: 'loopback' }) in audio-loopback.ts,
 *  captures system audio output as a MediaStream. The audio track is wired
 *  into an AnalyserNode for the visualizer. The video track is dropped.
 *
 *  Caveats:
 *   - Loopback is Windows-only via Electron's loopback handler. macOS/Linux
 *     return no audio tracks.
 *   - Captures ALL system audio, not just Spotify.
 *   - Requires a user gesture; must be invoked from a click handler.
 */

let _analyser: AnalyserNode | null = null
let _streamSource: MediaStreamAudioSourceNode | null = null
let _stream: MediaStream | null = null
let _running = false

export function connectToAnalyser(audioCtx: AudioContext): AnalyserNode {
  if (_analyser) return _analyser
  _analyser = audioCtx.createAnalyser()
  _analyser.fftSize = 2048
  _analyser.smoothingTimeConstant = 0.8
  return _analyser
}

export async function startLoopback(audioCtx: AudioContext): Promise<boolean> {
  if (_running) return true
  const analyser = connectToAnalyser(audioCtx)

  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    })

    // Drop video tracks immediately — we only want audio.
    for (const v of stream.getVideoTracks()) {
      v.stop()
      stream.removeTrack(v)
    }

    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length === 0) {
      console.warn('[SpotifyPlayerAudio] getDisplayMedia returned no audio tracks (Windows-only feature).')
      stream.getTracks().forEach((t) => t.stop())
      return false
    }

    _stream = stream
    _streamSource = audioCtx.createMediaStreamSource(stream)
    // NOTE: do NOT connect analyser to destination — that would loop the
    // captured audio back to the speakers and feed itself.
    _streamSource.connect(analyser)
    _running = true
    return true
  } catch (err) {
    console.warn('[SpotifyPlayerAudio] startLoopback failed:', err)
    return false
  }
}

export function stopLoopback(): void {
  if (_streamSource) {
    try { _streamSource.disconnect() } catch { /* already disconnected */ }
    _streamSource = null
  }
  if (_stream) {
    _stream.getTracks().forEach((t) => { try { t.stop() } catch { /* ignore */ } })
    _stream = null
  }
  _running = false
}

export function isLoopbackRunning(): boolean { return _running }

export function getAnalyserNode(): AnalyserNode | null { return _analyser }

export function resetAudioRouting(): void {
  stopLoopback()
  _analyser = null
}
