import { describe, expect, it } from 'vitest'
import { buildHarp } from '../harmonica/harp'
import { midiToFreq } from '../music/pitch'
import {
  ReedMeasure,
  centsAtA4,
  healthReeds,
  summarizeHealth,
  type MeasureState,
  type ReedResult,
} from './healthCheck'

/** Feeds `cents(t)` from the reed's note (null = silence) every 50 ms from `from` to `to`
 *  inclusive; returns the last state. */
function feed(m: ReedMeasure, from: number, to: number, cents: (t: number) => number | null) {
  let state: MeasureState = m.state
  for (let t = from; t <= to; t += 50) {
    const c = cents(t)
    state = m.push(c === null ? null : midiToFreq(m.midi) * 2 ** (c / 1200), t)
  }
  return state
}

describe('healthReeds', () => {
  it('lists the 20 unbent reeds, blow then draw per hole', () => {
    const reeds = healthReeds(buildHarp('C'))
    expect(reeds).toHaveLength(20)
    expect(reeds.slice(0, 3)).toEqual([
      { hole: 1, technique: 'blow', midi: 60 },
      { hole: 1, technique: 'draw', midi: 62 },
      { hole: 2, technique: 'blow', midi: 64 },
    ])
    expect(reeds[19]).toEqual({ hole: 10, technique: 'draw', midi: 93 })
  })

  it('follows the tuning', () => {
    expect(healthReeds(buildHarp('C', 'paddy'))[4]).toEqual({
      hole: 3,
      technique: 'blow',
      midi: 69,
    })
  })
})

describe('ReedMeasure', () => {
  it('measures a steady reed after one second', () => {
    const m = new ReedMeasure(69)
    expect(feed(m, 0, 950, () => 12)).toMatchObject({ status: 'measuring', progress: 0.95 })
    const done = feed(m, 1000, 1000, () => 12)
    expect(done.status).toBe('done')
    expect(done.result).toBeCloseTo(12, 6)
  })

  it('records the median of a drifting second', () => {
    const m = new ReedMeasure(69)
    // −20, −18, … +20 cents over 0–1000 ms
    const done = feed(m, 0, 1000, (t) => -20 + t / 25)
    expect(done.status).toBe('done')
    expect(done.result).toBeCloseTo(0, 6)
  })

  it('ignores a note more than 60 cents off, and restarts the second after one', () => {
    const m = new ReedMeasure(69)
    const off = feed(m, 0, 2000, () => 70)
    expect(off).toMatchObject({ status: 'waiting', progress: 0, result: null })
    expect(off.cents).toBeCloseTo(70, 6)
    feed(m, 2050, 2500, () => 0)
    feed(m, 2550, 2550, () => -61)
    expect(feed(m, 2600, 3550, () => 0).status).toBe('measuring')
    expect(feed(m, 3600, 3600, () => 0).status).toBe('done')
  })

  it('bridges a dropped frame but restarts after real silence', () => {
    const blip = new ReedMeasure(69)
    feed(blip, 0, 400, () => 5)
    expect(feed(blip, 450, 450, () => null)).toMatchObject({ status: 'measuring', cents: null })
    expect(feed(blip, 500, 1000, () => 5).status).toBe('done')

    const gap = new ReedMeasure(69)
    feed(gap, 0, 500, () => 5)
    expect(feed(gap, 550, 700, () => null).status).toBe('waiting')
    expect(feed(gap, 750, 1700, () => 5).status).toBe('measuring')
    expect(feed(gap, 1750, 1750, () => 5).status).toBe('done')
  })

  it('with afterSilence, waits for the previous note to stop', () => {
    const m = new ReedMeasure(67, 440, { afterSilence: true })
    expect(feed(m, 0, 2000, () => 0).status).toBe('waiting')
    feed(m, 2050, 2050, () => null)
    expect(feed(m, 2100, 3100, () => 0).status).toBe('done')
  })

  it('stays done', () => {
    const m = new ReedMeasure(69)
    const done = feed(m, 0, 1000, () => 3)
    expect(m.push(null, 1050)).toBe(done)
  })
})

describe('summarizeHealth', () => {
  const reeds = healthReeds(buildHarp('C'))
  const results = (cents: (number | null)[]): ReedResult[] =>
    reeds.map((r, i) => ({ ...r, cents: cents[i] ?? null }))

  it('lists the worst reeds and the average offset', () => {
    const s = summarizeHealth(results([2, -30, 12, 0, -8, 40, null, 5]), 440, [430, 450])
    expect(s.measured).toBe(7)
    expect(s.averageCents).toBeCloseTo(3, 6)
    expect(s.worst.map((r) => [r.hole, r.technique, r.cents])).toEqual([
      [3, 'draw', 40],
      [1, 'draw', -30],
      [2, 'blow', 12],
    ])
    expect(s.suggestedA4).toBeNull()
  })

  it('suggests the A4 a sharp harp is tuned to', () => {
    // +8 cents on average: 440 × 2^(8/1200) = 442.03 Hz
    expect(summarizeHealth(results(Array(20).fill(8)), 440, [430, 450]).suggestedA4).toBe(442)
    // +12 cents: 443.06 Hz
    expect(summarizeHealth(results(Array(20).fill(12)), 440, [430, 450]).suggestedA4).toBe(443)
    // measured against 442 already, a +0.5 cent harp needs nothing
    expect(summarizeHealth(results(Array(20).fill(0.5)), 442, [430, 450]).suggestedA4).toBeNull()
    // stays inside the setting's range
    expect(summarizeHealth(results(Array(20).fill(60)), 448, [430, 450]).suggestedA4).toBe(450)
  })

  it('needs five measured reeds before suggesting anything', () => {
    expect(summarizeHealth(results([9, 9, 9, 9]), 440, [430, 450]).suggestedA4).toBeNull()
    expect(summarizeHealth(results([9, 9, 9, 9, 9]), 440, [430, 450]).suggestedA4).toBe(442)
  })

  it('says nothing when every reed was skipped', () => {
    expect(summarizeHealth(results([]), 440, [430, 450])).toEqual({
      measured: 0,
      averageCents: null,
      worst: [],
      suggestedA4: null,
    })
  })
})

describe('centsAtA4', () => {
  it('re-reads cents against another reference pitch', () => {
    expect(centsAtA4(8, 440, 442)).toBeCloseTo(0.15, 2)
    expect(centsAtA4(0, 442, 440)).toBeCloseTo(7.85, 2)
    expect(centsAtA4(-3, 440, 440)).toBe(-3)
  })
})
