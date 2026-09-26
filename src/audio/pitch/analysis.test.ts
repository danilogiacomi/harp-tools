import { PitchDetector as Mpm } from 'pitchy'
import { describe, expect, it } from 'vitest'
import { centsOff } from '../../core/music/pitch'
import { MedianSmoother, analyzeFrame, computeRms } from './analysis'

const SR = 48000
const N = 2048
const GATE = { minClarity: 0.9, noiseFloor: 0.01 }
const mpm = Mpm.forFloat32Array(N)
const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12)

function tone(freq: number, shape: 'sine' | 'saw', amp = 0.5): Float32Array {
  const buf = new Float32Array(N)
  if (shape === 'sine') {
    for (let i = 0; i < N; i++) {
      const phase = (freq * i) / SR - Math.floor((freq * i) / SR)
      buf[i] = amp * Math.sin(2 * Math.PI * phase)
    }
    return buf
  }
  // Band-limited additive sawtooth (harmonics only below 20 kHz): a naive `2*phase-1`
  // sawtooth aliases at high pitches at 48 kHz, folding energy above 24 kHz back as
  // inharmonic noise that neither a harmonica reed nor a mic's anti-aliased ADC produces.
  for (let k = 1; k * freq < 20000; k++) {
    for (let i = 0; i < N; i++) {
      buf[i] += Math.sin((2 * Math.PI * k * freq * i) / SR) / k
    }
  }
  const scale = (amp * 2) / Math.PI
  for (let i = 0; i < N; i++) buf[i] *= scale
  return buf
}

function noise(amp: number, seed = 1): Float32Array {
  let s = seed
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1
  return Float32Array.from({ length: N }, () => amp * rand())
}

// G harp hole 1 blow (G3) up to F# harp hole 10 overdraw (G7).
const MIDI_RANGE = Array.from({ length: 103 - 55 + 1 }, (_, i) => 55 + i)

describe('computeRms', () => {
  it('measures signal level', () => {
    expect(computeRms(new Float32Array(N))).toBe(0)
    expect(computeRms(new Float32Array(N).fill(0.5))).toBeCloseTo(0.5, 9)
    expect(computeRms(tone(440, 'sine', 1))).toBeCloseTo(Math.SQRT1_2, 2)
  })
})

describe('analyzeFrame', () => {
  it.each(MIDI_RANGE)('detects a sine at MIDI %i within ±5 cents', (midi) => {
    const { reading } = analyzeFrame(tone(midiToHz(midi), 'sine'), SR, mpm, GATE)
    expect(reading).not.toBeNull()
    expect(Math.abs(centsOff(reading!.freq, midi))).toBeLessThan(5)
  })

  it.each(MIDI_RANGE)('detects a harmonic-rich sawtooth at MIDI %i within ±5 cents', (midi) => {
    const { reading } = analyzeFrame(tone(midiToHz(midi), 'saw'), SR, mpm, GATE)
    expect(reading).not.toBeNull()
    expect(Math.abs(centsOff(reading!.freq, midi))).toBeLessThan(5)
  })

  it('returns null for silence but still reports the level', () => {
    expect(analyzeFrame(new Float32Array(N), SR, mpm, GATE)).toEqual({ reading: null, rms: 0 })
  })

  it('returns null for a tone below the noise floor', () => {
    const { reading, rms } = analyzeFrame(tone(440, 'sine', 0.005), SR, mpm, GATE)
    expect(reading).toBeNull()
    expect(rms).toBeGreaterThan(0)
  })

  it('returns null for breath-like noise', () => {
    const { reading, rms } = analyzeFrame(noise(0.3), SR, mpm, GATE)
    expect(reading).toBeNull()
    expect(rms).toBeGreaterThan(GATE.noiseFloor)
  })
})

describe('MedianSmoother', () => {
  it('suppresses a single octave spike', () => {
    const m = new MedianSmoother(3)
    expect(m.push(440)).toBe(440)
    expect(m.push(880)).toBe(440)
    expect(m.push(441)).toBe(441)
  })
  it('resets on silence', () => {
    const m = new MedianSmoother(3)
    m.push(440)
    m.push(440)
    expect(m.push(null)).toBeNull()
    expect(m.push(220)).toBe(220)
  })
})
