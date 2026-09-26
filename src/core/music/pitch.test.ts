import { describe, expect, it } from 'vitest'
import { centsOff, freqToMidi, midiToFreq } from './pitch'

describe('midiToFreq', () => {
  it('maps A4 (69) to the reference', () => {
    expect(midiToFreq(69)).toBe(440)
    expect(midiToFreq(69, 442)).toBe(442)
  })
  it('maps middle C', () => {
    expect(midiToFreq(60)).toBeCloseTo(261.6256, 3)
  })
  it('doubles per octave', () => {
    expect(midiToFreq(81)).toBeCloseTo(880, 6)
  })
})

describe('freqToMidi', () => {
  it('finds exact notes with ~0 cents', () => {
    const r = freqToMidi(440)
    expect(r.midi).toBe(69)
    expect(r.cents).toBeCloseTo(0, 6)
  })
  it('reports sharp and flat deviation', () => {
    expect(freqToMidi(445).cents).toBeCloseTo(19.56, 1)
    const flat = freqToMidi(midiToFreq(64) * 2 ** (-30 / 1200))
    expect(flat.midi).toBe(64)
    expect(flat.cents).toBeCloseTo(-30, 6)
  })
  it('rounds to the nearest note near the ±50 cent boundary', () => {
    const r = freqToMidi(440 * 2 ** (49 / 1200))
    expect(r.midi).toBe(69)
    expect(r.cents).toBeCloseTo(49, 6)
  })
  it('honours a custom A4', () => {
    const r = freqToMidi(442, 442)
    expect(r.midi).toBe(69)
    expect(r.cents).toBeCloseTo(0, 6)
  })
})

describe('centsOff', () => {
  it('measures distance to an arbitrary target note', () => {
    expect(centsOff(440, 67)).toBeCloseTo(200, 6)
  })
})
