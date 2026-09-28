import type { ClickKind } from '../core/rhythm/schedule'

/** A click's length; it decays to 0.001 of its peak by the end. */
export const CLICK_S = 0.04

/**
 * Band-passed noise, not a tone: the mic must never read the metronome as a note (a sine click
 * passed the pitch gate). Accented clicks are louder and brighter.
 */
export const CLICK_SOUND: Record<ClickKind, { centerHz: number; gain: number }> = {
  bar: { centerHz: 3500, gain: 0.6 },
  group: { centerHz: 3000, gain: 0.45 },
  beat: { centerHz: 2500, gain: 0.35 },
  sub: { centerHz: 2000, gain: 0.15 },
}

/** Wide enough that the burst has no pitch. */
const Q = 0.7

/** The samples of one click: seeded noise through a band-pass, peaking at the kind's gain. */
export function clickSamples(kind: ClickKind, sampleRate: number): Float32Array {
  const { centerHz, gain } = CLICK_SOUND[kind]
  const out = new Float32Array(Math.round(sampleRate * CLICK_S))
  // RBJ cookbook band-pass (0 dB peak gain).
  const w = (2 * Math.PI * centerHz) / sampleRate
  const alpha = Math.sin(w) / (2 * Q)
  const a0 = 1 + alpha
  const [b0, b2] = [alpha / a0, -alpha / a0]
  const [a1, a2] = [(-2 * Math.cos(w)) / a0, (1 - alpha) / a0]
  let seed = 1
  let [x1, x2, y1, y2] = [0, 0, 0, 0]
  for (let i = 0; i < out.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    const x = (seed / 2 ** 32) * 2 - 1
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2
    ;[x2, x1, y2, y1] = [x1, x, y1, y]
    out[i] = y * 0.001 ** (i / out.length)
  }
  let peak = 0
  for (const v of out) peak = Math.max(peak, Math.abs(v))
  for (let i = 0; i < out.length; i++) out[i] *= gain / peak
  return out
}
