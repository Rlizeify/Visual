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
    throw new Error('No audio shared. Pick a tab or screen and tick "Share audio".')
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
