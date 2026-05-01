// PadEngine — manages 16 beat pad slots with one-shot playback

export interface PadSlot {
  id: number
  buffer: AudioBuffer | null
  fileName: string
  volume: number
  pitch: number
  velocity: number
}

function createEmptySlot(id: number): PadSlot {
  return { id, buffer: null, fileName: '', volume: 1, pitch: 0, velocity: 1 }
}

export class PadEngine {
  private ctx: AudioContext
  private masterGain: GainNode
  private slots: PadSlot[]
  private activeSources: Map<number, AudioBufferSourceNode> = new Map()
  private onSlotsChange: (() => void) | null = null

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.masterGain = ctx.createGain()
    this.masterGain.connect(ctx.destination)
    this.slots = Array.from({ length: 16 }, (_, i) => createEmptySlot(i))
  }

  setOnSlotsChange(cb: () => void) {
    this.onSlotsChange = cb
  }

  private notify() {
    this.onSlotsChange?.()
  }

  getSlots(): PadSlot[] {
    return this.slots
  }

  getSlot(index: number): PadSlot {
    return this.slots[index]
  }

  async assignSample(index: number, arrayBuffer: ArrayBuffer, fileName: string) {
    const buffer = await this.ctx.decodeAudioData(arrayBuffer)
    this.slots[index] = { ...this.slots[index], buffer, fileName }
    this.notify()
  }

  clearSlot(index: number) {
    this.stopSlot(index)
    this.slots[index] = createEmptySlot(index)
    this.notify()
  }

  trigger(index: number, velocity = 1) {
    const slot = this.slots[index]
    if (!slot.buffer) return
    this.stopSlot(index)

    const source = this.ctx.createBufferSource()
    const gain = this.ctx.createGain()
    source.buffer = slot.buffer
    source.playbackRate.value = Math.pow(2, slot.pitch / 12)
    gain.gain.value = slot.volume * velocity
    source.connect(gain)
    gain.connect(this.masterGain)

    source.onended = () => {
      this.activeSources.delete(index)
      gain.disconnect()
    }

    source.start()
    this.activeSources.set(index, source)
  }

  private stopSlot(index: number) {
    const src = this.activeSources.get(index)
    if (src) {
      try { src.stop() } catch { /* already stopped */ }
      src.disconnect()
      this.activeSources.delete(index)
    }
  }

  setSlotVolume(index: number, volume: number) {
    this.slots[index].volume = Math.max(0, Math.min(1, volume))
    this.notify()
  }

  setSlotPitch(index: number, pitch: number) {
    this.slots[index].pitch = pitch
    this.notify()
  }

  dispose() {
    this.activeSources.forEach((src) => {
      try { src.stop() } catch { /* ok */ }
      src.disconnect()
    })
    this.activeSources.clear()
    this.masterGain.disconnect()
  }
}
