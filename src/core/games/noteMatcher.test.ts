import { describe, expect, it } from 'vitest'
import { midiToFreq } from '../music/pitch'
import { NoteMatcher, stabilityScore, type MatcherConfig } from './noteMatcher'

const CONFIG: MatcherConfig = { toleranceCents: 25, holdMs: 500 }
/** A4 (MIDI 69) detuned by `cents`. */
const a4 = (cents = 0) => midiToFreq(69 + cents / 100)

describe('NoteMatcher', () => {
  it('matches after the pitch is held for holdMs', () => {
    const m = new NoteMatcher(69, CONFIG)
    for (let t = 0; t <= 300; t += 100) m.push(a4(5), t)
    const at400 = m.push(a4(5), 400)
    expect(at400.progress).toBeCloseTo(0.8)
    expect(at400.matched).toBe(false)
    const at500 = m.push(a4(5), 500)
    expect(at500).toMatchObject({ matched: true, progress: 1, inTune: true, holdStartMs: 0 })
    expect(at500.cents).toBeCloseTo(5)
  })

  it('starts with zero progress on the first in-tune reading', () => {
    expect(new NoteMatcher(69, CONFIG).push(a4(), 1000)).toMatchObject({
      progress: 0,
      matched: false,
      holdStartMs: 1000,
    })
  })

  it('resets the hold on a null reading', () => {
    const m = new NoteMatcher(69, CONFIG)
    for (let t = 0; t <= 200; t += 100) m.push(a4(), t)
    expect(m.push(null, 300)).toMatchObject({
      progress: 0,
      inTune: false,
      cents: null,
      holdStartMs: null,
    })
    for (let t = 400; t <= 800; t += 100) expect(m.push(a4(), t).matched).toBe(false)
    expect(m.push(a4(), 900).matched).toBe(true)
  })

  it('resets the hold when the pitch drifts out of tolerance', () => {
    const m = new NoteMatcher(69, CONFIG)
    m.push(a4(24), 0)
    m.push(a4(-24), 200)
    const off = m.push(a4(26), 300)
    expect(off.inTune).toBe(false)
    expect(off.cents).toBeCloseTo(26)
    expect(off.holdStartMs).toBeNull()
    m.push(a4(), 400)
    expect(m.push(a4(), 800).matched).toBe(false)
    expect(m.push(a4(), 900).matched).toBe(true)
  })

  it('stays matched afterwards', () => {
    const m = new NoteMatcher(69, CONFIG)
    m.push(a4(), 0)
    m.push(a4(), 500)
    expect(m.push(null, 600)).toMatchObject({ matched: true, progress: 1 })
    expect(m.state.matched).toBe(true)
  })

  it('uses the configured tolerance and hold time', () => {
    const m = new NoteMatcher(69, { toleranceCents: 10, holdMs: 250 })
    expect(m.push(a4(15), 0).inTune).toBe(false)
    m.push(a4(5), 100)
    expect(m.push(a4(5), 350).matched).toBe(true)
  })

  it('measures against the configured A4', () => {
    expect(new NoteMatcher(69, CONFIG, 450).push(440, 0).inTune).toBe(false) // −39 cents
    expect(new NoteMatcher(69, CONFIG, 450).push(450, 0).inTune).toBe(true)
  })

  it('records the cents of the current hold', () => {
    const m = new NoteMatcher(69, CONFIG)
    m.push(a4(30), 0)
    m.push(a4(5), 100)
    m.push(a4(-5), 300)
    m.push(a4(5), 600)
    const cents = m.holdCents
    expect(cents).toHaveLength(3)
    expect(cents[0]).toBeCloseTo(5)
    expect(cents[1]).toBeCloseTo(-5)
    expect(cents[2]).toBeCloseTo(5)
  })
})

describe('stabilityScore', () => {
  it('is 1 for a rock-steady hold and falls with the spread', () => {
    expect(stabilityScore([0, 0, 0], 25)).toBe(1)
    expect(stabilityScore([10, -10, 10, -10], 25)).toBeCloseTo(0.6)
    expect(stabilityScore([30, -30], 25)).toBe(0)
  })
  it('is 0 without samples', () => {
    expect(stabilityScore([], 25)).toBe(0)
  })
})
