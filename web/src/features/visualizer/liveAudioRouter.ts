// Owns the persistent shared AnalyserNode and the wiring of one optional
// live MediaStreamAudioSourceNode into it. The engine creates one of these
// at initialize() time and delegates all enable/disable/read calls to it.
// Butterchurn, the signal meter, and the T3 waveform sampler all read from
// the same AnalyserNode this object holds.

import { captureMicStream, captureTabStream, type CapturedStream } from './liveAudioCapture'

export class LiveAudioRouter {
  readonly analyser: AnalyserNode
  private liveStream: MediaStream | null = null
  private liveSource: MediaStreamAudioSourceNode | null = null
  private label = ''

  constructor(private readonly ctx: AudioContext) {
    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 4096
    this.analyser.smoothingTimeConstant = 0.65
  }

  isEnabled(): boolean { return this.liveStream !== null }
  getLabel(): string { return this.label }

  async enableMic(deviceId?: string): Promise<{ deviceId: string; label: string }> {
    this.disable()
    await this.resumeCtx()
    const captured = await captureMicStream(deviceId)
    this.attach(captured)
    return { deviceId: captured.deviceId, label: captured.label }
  }

  async enableTab(): Promise<{ label: string }> {
    this.disable()
    await this.resumeCtx()
    const captured = await captureTabStream()
    captured.stream.getAudioTracks()[0]
      .addEventListener('ended', () => this.disable())
    this.attach(captured)
    return { label: captured.label }
  }

  // 0..1 average frequency level — drives the gear-icon SIGNAL meter.
  getSignalLevel(): number {
    const buf = new Uint8Array(this.analyser.frequencyBinCount)
    this.analyser.getByteFrequencyData(buf)
    let sum = 0
    for (let i = 0; i < buf.length; i++) sum += buf[i]
    return sum / (buf.length * 255)
  }

  disable(): void {
    if (this.liveSource) { try { this.liveSource.disconnect() } catch { /* noop */ } }
    if (this.liveStream) { for (const t of this.liveStream.getTracks()) t.stop() }
    this.liveSource = null
    this.liveStream = null
    this.label = ''
  }

  private attach(c: CapturedStream): void {
    this.liveStream = c.stream
    this.liveSource = this.ctx.createMediaStreamSource(c.stream)
    this.liveSource.connect(this.analyser)
    this.label = c.label
  }

  private async resumeCtx(): Promise<void> {
    if (this.ctx.state === 'suspended') await this.ctx.resume()
  }
}
