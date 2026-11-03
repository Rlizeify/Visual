// MediaStream acquisition for the visualizer's live audio input.
// Pure capture helpers — no AudioContext / AnalyserNode wiring lives here.
// The engine calls these, then connects the returned MediaStream into its
// shared AnalyserNode.

export interface CapturedStream {
  stream: MediaStream
  deviceId: string
  label: string
}

const NO_DSP: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
}

// Microphone (or any audio input the user picks) via getUserMedia.
// Fallback source — works on any device, captures room sound.
export async function captureMicStream(deviceId?: string): Promise<CapturedStream> {
  const constraints: MediaTrackConstraints = { ...NO_DSP }
  if (deviceId) constraints.deviceId = { exact: deviceId }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints })
  const track = stream.getAudioTracks()[0]
  return {
    stream,
    deviceId: (track?.getSettings().deviceId as string) || deviceId || '',
    label: track?.label || '',
  }
}

// Tab or screen audio via getDisplayMedia (primary source). Chromium
// requires video:true; we drop video.
// Callers must wire the track's 'ended' event to teardown.
export async function captureTabStream(): Promise<CapturedStream> {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
  for (const t of stream.getVideoTracks()) t.stop()

  const audioTracks = stream.getAudioTracks()
  if (audioTracks.length === 0) {
    for (const t of stream.getTracks()) t.stop()
    throw new Error('That share has no audio. Try again and turn on "Share system audio" (or "Share tab audio").')
  }

  return {
    stream,
    deviceId: '',
    label: audioTracks[0].label || 'Tab audio',
  }
}

export async function listAudioInputDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices.filter(d => d.kind === 'audioinput')
}

// Tab/screen capture with audio: desktop Chromium/Edge/Firefox only.
// Phones either lack getDisplayMedia or can't share audio through it.
export function canCaptureDisplayAudio(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.mediaDevices?.getDisplayMedia !== 'function') return false
  const touchOnly = typeof matchMedia === 'function' &&
    matchMedia('(pointer: coarse)').matches && !matchMedia('(hover: hover)').matches
  return !touchOnly
}

export function canCaptureMic(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function'
}

/** Plain-language message for a failed capture. */
export function describeCaptureError(err: unknown, source: 'tab' | 'mic'): string {
  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return source === 'mic'
      ? 'Microphone access was blocked. Allow it in your browser’s site settings, then try again.'
      : 'Sharing was cancelled or blocked. Try again and pick a screen or tab.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone found on this device.'
  if (name === 'NotReadableError') return 'Another app is using the microphone. Close it and try again.'
  return err instanceof Error ? err.message : 'Could not start audio capture.'
}
