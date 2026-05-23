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

// System loopback (BlackHole / VB-Cable / any audio input).
// If no deviceId is given and BlackHole is present, switches to it.
export async function captureMicStream(deviceId?: string): Promise<CapturedStream> {
  const constraints: MediaTrackConstraints = { ...NO_DSP }
  if (deviceId) constraints.deviceId = { exact: deviceId }

  let stream = await navigator.mediaDevices.getUserMedia({ audio: constraints })
  let track = stream.getAudioTracks()[0]
  let resolvedId = (track?.getSettings().deviceId as string) || deviceId || ''
  let label = track?.label || ''

  if (!deviceId) {
    const inputs = (await navigator.mediaDevices.enumerateDevices())
      .filter(d => d.kind === 'audioinput')
    const blackhole = inputs.find(d => /blackhole/i.test(d.label))
    if (blackhole && blackhole.deviceId !== resolvedId) {
      for (const t of stream.getTracks()) t.stop()
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { ...NO_DSP, deviceId: { exact: blackhole.deviceId } },
      })
      track = stream.getAudioTracks()[0]
      resolvedId = (track?.getSettings().deviceId as string) || blackhole.deviceId
      label = track?.label || blackhole.label
    }
  }

  return { stream, deviceId: resolvedId, label }
}

// Tab audio via getDisplayMedia. Chromium requires video:true; we drop video.
// Callers must wire the track's 'ended' event to teardown.
export async function captureTabStream(): Promise<CapturedStream> {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
  for (const t of stream.getVideoTracks()) t.stop()

  const audioTracks = stream.getAudioTracks()
  if (audioTracks.length === 0) {
    for (const t of stream.getTracks()) t.stop()
    throw new Error('No tab audio shared. Pick a TAB and check "Share tab audio".')
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
