import { PitchDetector as Mpm } from 'pitchy'
import { describe, expect, it } from 'vitest'
import type { ClickKind } from '../core/rhythm/schedule'
import { CLICK_SOUND, clickSamples } from './click'
import { analyzeFrame } from './pitch/analysis'

// The mic's analysis window and the games' gate (usePitch: clarity 0.9, default noise floor).
const N = 2048
const GATE = { minClarity: 0.9, noiseFloor: 0.01 }
const KINDS: ClickKind[] = ['bar', 'group', 'beat', 'sub']
const STEP = 16

/**
 * Every analysis window the click can fall in, 16 samples apart, from the click entering the
 * window to its tail leaving it, over a quiet room's noise.
 */
function windows(click: Float32Array): { at: number; buf: Float32Array }[] {
  let seed = 7
  const room = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return 0.002 * ((seed / 2 ** 32) * 2 - 1)
  }
  const out = []
  for (let at = -N + STEP; at < click.length; at += STEP) {
    const buf = Float32Array.from({ length: N }, (_, i) => room() + (click[i + at] ?? 0))
    out.push({ at, buf })
  }
  return out
}

/** The old click: a 1600 Hz sine burst decaying to 0.001 over 40 ms. */
function sineClick(sampleRate: number): Float32Array {
  return Float32Array.from(
    { length: Math.round(sampleRate * 0.05) },
    (_, i) =>
      0.6 *
      (0.001 / 0.6) ** (i / sampleRate / 0.04) *
      Math.sin((2 * Math.PI * 1600 * i) / sampleRate),
  )
}

describe('metronome click', () => {
  it.each([44100, 48000])('a sine click would pass the pitch gate (at %i Hz)', (sampleRate) => {
    const mpm = Mpm.forFloat32Array(N)
    const heard = windows(sineClick(sampleRate)).filter(
      (w) => analyzeFrame(w.buf, sampleRate, mpm, GATE).reading !== null,
    )
    expect(heard.length).toBeGreaterThan(0)
  })

  it.each([44100, 48000])(
    'is unpitched: no click kind passes the pitch gate (%i Hz)',
    (sampleRate) => {
      const mpm = Mpm.forFloat32Array(N)
      for (const kind of KINDS) {
        let loudest = 0
        for (const { at, buf } of windows(clickSamples(kind, sampleRate))) {
          const { reading, rms } = analyzeFrame(buf, sampleRate, mpm, GATE)
          expect([kind, at, reading]).toEqual([kind, at, null])
          loudest = Math.max(loudest, rms)
        }
        expect(loudest).toBeGreaterThan(GATE.noiseFloor) // loud enough to be judged
      }
    },
  )

  it('keeps the accents: the bar loudest, then group, beat and sub', () => {
    const peak = (kind: ClickKind) => Math.max(...clickSamples(kind, 48000).map(Math.abs))
    expect(peak('bar')).toBeCloseTo(CLICK_SOUND.bar.gain, 2)
    expect(peak('bar')).toBeGreaterThan(peak('group'))
    expect(peak('group')).toBeGreaterThan(peak('beat'))
    expect(peak('beat')).toBeGreaterThan(peak('sub'))
    expect(CLICK_SOUND.bar.centerHz).toBeGreaterThan(CLICK_SOUND.beat.centerHz)
  })

  it('is deterministic and short', () => {
    expect(clickSamples('beat', 48000)).toEqual(clickSamples('beat', 48000))
    expect(clickSamples('beat', 48000).length).toBe(1920) // 40 ms
  })
})
