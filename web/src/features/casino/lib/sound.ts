// Casino sound effects, synthesized with Web Audio — no audio files.
//
// Output only: one lazily created AudioContext for the casino page, never
// connected to the visualizer's input pipeline or its AnalyserNode. Browsers
// start it suspended until a click, so every sound first resumes it.
// Muting is a per-device preference (localStorage, best effort).

const KEY = 'mheu_casino_muted'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noiseBuf: AudioBuffer | null = null
let muted = (() => { try { return localStorage.getItem(KEY) === '1' } catch { return false } })()
const listeners = new Set<(m: boolean) => void>()

export const isMuted = () => muted
export function setMuted(m: boolean) {
  muted = m
  try { localStorage.setItem(KEY, m ? '1' : '0') } catch { /* private mode */ }
  if (master) master.gain.value = m ? 0 : 0.5
  if (m) stopRocket()
  listeners.forEach(f => f(m))
}
export function onMuted(f: (m: boolean) => void) { listeners.add(f); return () => { listeners.delete(f) } }

function audio(): { c: AudioContext; out: GainNode } | null {
  if (muted || typeof window === 'undefined') return null
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!ctx) {
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return { c: ctx, out: master! }
}

function noise(c: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noiseBuf
}

/** One enveloped oscillator note. */
function tone(freq: number, at: number, dur: number, opts: { type?: OscillatorType; gain?: number; to?: number } = {}) {
  const a = audio(); if (!a) return
  const t = a.c.currentTime + at
  const o = a.c.createOscillator(), g = a.c.createGain()
  o.type = opts.type ?? 'sine'
  o.frequency.setValueAtTime(freq, t)
  if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.3, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(a.out)
  o.start(t); o.stop(t + dur + 0.02)
}

/** A filtered burst of noise. */
function hiss(at: number, dur: number, opts: { freq: number; q?: number; gain?: number; type?: BiquadFilterType; to?: number }) {
  const a = audio(); if (!a) return
  const t = a.c.currentTime + at
  const src = a.c.createBufferSource(), f = a.c.createBiquadFilter(), g = a.c.createGain()
  src.buffer = noise(a.c)
  f.type = opts.type ?? 'bandpass'
  f.frequency.setValueAtTime(opts.freq, t)
  if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + dur)
  f.Q.value = opts.q ?? 1
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.4, t + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(a.out)
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02)
}

export const sfx = {
  /** A chip set down: two quick clacks. */
  chip() {
    tone(2400, 0, 0.05, { type: 'triangle', gain: 0.18 })
    tone(3100, 0.03, 0.04, { type: 'triangle', gain: 0.12 })
  },
  /** Card turning over: a short papery swish. */
  flip() { hiss(0, 0.09, { freq: 3500, q: 0.8, gain: 0.25, to: 1800 }) },
  /** Card sliding off the shoe. */
  deal() { hiss(0, 0.12, { freq: 1600, q: 0.6, gain: 0.12, type: 'lowpass', to: 600 }) },
  /** The roulette ball clicking over frets, slowing down over `ms`. */
  wheel(ms: number) {
    const n = 46
    for (let i = 0; i < n; i++) {
      // Ease-out spacing: dense at first, sparse as it slows.
      const at = (ms / 1000) * (1 - Math.pow(1 - i / n, 2.2)) * 0.97
      tone(1700 + Math.random() * 500, at, 0.025, { type: 'square', gain: 0.05 })
    }
    tone(900, ms / 1000, 0.12, { type: 'triangle', gain: 0.2 }) // the drop
  },
  /** Rising arpeggio; bigger wins ring longer. */
  win(big = false) {
    const notes = big ? [523, 659, 784, 1047, 1319] : [523, 659, 784, 1047]
    notes.forEach((f, i) => tone(f, i * 0.07, big ? 0.5 : 0.3, { type: 'triangle', gain: 0.22 }))
  },
  /** Two falling notes. */
  lose() {
    tone(330, 0, 0.22, { type: 'sawtooth', gain: 0.08, to: 300 })
    tone(247, 0.18, 0.35, { type: 'sawtooth', gain: 0.08, to: 196 })
  },
  /** Countdown pip; the last one is higher. */
  beep(last = false) { tone(last ? 1320 : 880, 0, 0.12, { type: 'sine', gain: 0.2 }) },
  /** Bust: low boom plus a noisy blast. */
  crash() {
    stopRocket()
    tone(140, 0, 0.6, { type: 'sine', gain: 0.5, to: 40 })
    hiss(0, 0.7, { freq: 1200, q: 0.4, gain: 0.5, type: 'lowpass', to: 120 })
  },
}

// ── rocket: a held engine rumble whose pitch follows the multiplier ──
let rocket: { src: AudioBufferSourceNode; f: BiquadFilterNode; g: GainNode; o: OscillatorNode } | null = null

export function startRocket() {
  const a = audio(); if (!a || rocket) return
  const src = a.c.createBufferSource(), f = a.c.createBiquadFilter(), g = a.c.createGain()
  const o = a.c.createOscillator(), og = a.c.createGain()
  src.buffer = noise(a.c); src.loop = true
  f.type = 'lowpass'; f.frequency.value = 400; f.Q.value = 2
  o.type = 'sawtooth'; o.frequency.value = 55; og.gain.value = 0.05
  g.gain.setValueAtTime(0.0001, a.c.currentTime)
  g.gain.exponentialRampToValueAtTime(0.22, a.c.currentTime + 0.4)
  src.connect(f).connect(g).connect(a.out)
  o.connect(og).connect(g)
  src.start(); o.start()
  rocket = { src, f, g, o }
}

/** Map the multiplier onto the engine's pitch. */
export function rocketPitch(mult: number) {
  if (!rocket || !ctx) return
  const lift = Math.log(Math.max(1, mult))
  rocket.f.frequency.setTargetAtTime(400 + 900 * lift, ctx.currentTime, 0.1)
  rocket.o.frequency.setTargetAtTime(55 + 60 * lift, ctx.currentTime, 0.1)
}

export function stopRocket() {
  if (!rocket || !ctx) return
  const r = rocket
  rocket = null
  const t = ctx.currentTime
  r.g.gain.cancelScheduledValues(t)
  r.g.gain.setValueAtTime(Math.max(r.g.gain.value, 0.0001), t)
  r.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15)
  r.src.stop(t + 0.2); r.o.stop(t + 0.2)
}
