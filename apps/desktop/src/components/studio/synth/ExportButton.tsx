import React from 'react'
import type { LayerConfig } from './SynthEngine'

interface Props {
  layers: Array<{ id: string; config: LayerConfig }>
}

const WAVE_MAP: Record<string, OscillatorType> = {
  sine: 'sine',
  saw: 'sawtooth',
  triangle: 'triangle',
  square: 'square',
}

function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1
  const bitDepth = 16
  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = samples.length * bytesPerSample
  const buf = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buf)

  const str = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }

  str(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)
  str(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return buf
}

export default function ExportButton({ layers }: Props) {
  const handleExport = async () => {
    const sampleRate = 44100
    const duration = 4
    const offlineCtx = new OfflineAudioContext(1, sampleRate * duration, sampleRate)
    const master = offlineCtx.createGain()
    master.connect(offlineCtx.destination)

    for (const { config } of layers) {
      if (!config.enabled) continue
      const osc = offlineCtx.createOscillator()
      const gain = offlineCtx.createGain()
      osc.type = WAVE_MAP[config.waveType] ?? 'sine'
      osc.frequency.value = config.frequency
      osc.detune.value = config.detune
      gain.gain.value = config.gain
      osc.connect(gain)
      gain.connect(master)
      osc.start(0)
      osc.stop(duration)
    }

    const rendered = await offlineCtx.startRendering()
    const wav = encodeWAV(rendered.getChannelData(0), sampleRate)
    const blob = new Blob([wav], { type: 'audio/wav' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `synth-patch-${Date.now()}.wav`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      style={{
        padding: '5px 14px', fontFamily: 'monospace', fontSize: 11,
        background: '#111', color: '#27e0e1', border: '1px solid #27e0e1',
        cursor: 'pointer', letterSpacing: 1,
      }}
    >
      EXPORT WAV
    </button>
  )
}
