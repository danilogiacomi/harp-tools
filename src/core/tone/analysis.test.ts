import { describe, expect, it } from 'vitest'
import { HoldTracker, analyzeHold, detectVibrato, type ToneSample } from './analysis'

/** Samples every `stepMs` from 0 to `ms` inclusive: G4 at 0 cents and −20 dB unless `f` says. */
const series = (ms: number, stepMs: number, f: (t: number) => Partial<ToneSample> = () => ({})) => {
  const out: ToneSample[] = []
  for (let t = 0; t <= ms; t += stepMs) out.push({ tMs: t, cents: 0, midi: 67, db: -20, ...f(t) })
  return out
}
const sine = (hz: number, amp: number) => (t: number) =>
  amp * Math.sin((2 * Math.PI * hz * t) / 1000)

describe('analyzeHold', () => {
  it('reports a steady note as steady, with no vibrato', () => {
    const s = analyzeHold(series(1500, 20, () => ({ cents: 3 })))!
    expect(s).toEqual({
      midi: 67,
      holdMs: 1500,
      pitchSigma: 0,
      meanDb: -20,
      dbSigma: 0,
      vibratoReady: true,
      vibrato: null,
    })
  })

  it('finds a 5 Hz, ±20 cent vibrato', () => {
    const s = analyzeHold(series(2500, 25, (t) => ({ cents: sine(5, 20)(t) })))!
    expect(s.vibrato!.rateHz).toBeCloseTo(5, 6)
    expect(s.vibrato!.depthCents).toBeCloseTo(40.17, 2)
    expect(s.pitchSigma).toBeCloseTo(14.06, 2)
  })

  it('finds vibrato on top of a slow drift', () => {
    const s = analyzeHold(series(2000, 25, (t) => ({ cents: -10 + t / 100 + sine(6, 15)(t) })))!
    expect(s.vibrato!.rateHz).toBeCloseTo(6.03, 2)
    expect(s.vibrato!.depthCents).toBeCloseTo(28.96, 2)
  })

  it('says "none" for shallow, too fast or too slow wobbles', () => {
    expect(analyzeHold(series(2000, 25, (t) => ({ cents: sine(5, 3)(t) })))!.vibrato).toBeNull()
    expect(analyzeHold(series(2000, 10, (t) => ({ cents: sine(12, 20)(t) })))!.vibrato).toBeNull()
    expect(analyzeHold(series(2000, 25, (t) => ({ cents: sine(2, 20)(t) })))!.vibrato).toBeNull()
  })

  it('waits for a one-second hold before judging vibrato', () => {
    const s = analyzeHold(series(900, 25, (t) => ({ cents: sine(5, 20)(t) })))!
    expect(s.vibratoReady).toBe(false)
    expect(s.vibrato).toBeNull()
  })

  it('measures a level swell', () => {
    const s = analyzeHold(series(2000, 25, (t) => ({ db: -40 + (30 * t) / 2000 })))!
    expect(s.meanDb).toBeCloseTo(-25, 6)
    expect(s.dbSigma).toBeCloseTo(8.77, 2)
    expect(s.pitchSigma).toBe(0)
  })

  it('returns null without samples', () => {
    expect(analyzeHold([])).toBeNull()
    expect(detectVibrato([])).toBeNull()
  })
})

describe('HoldTracker', () => {
  it('starts a new hold after a break of more than 150 ms', () => {
    const tracker = new HoldTracker()
    series(1000, 50).forEach((s) => tracker.push(s))
    expect(tracker.isActive(1100)).toBe(true)
    expect(tracker.isActive(1200)).toBe(false)
    // the last hold stays readable until the next note
    expect(analyzeHold(tracker.hold)!.holdMs).toBe(1000)
    series(300, 50).forEach((s) => tracker.push({ ...s, tMs: s.tMs + 1200 }))
    expect(analyzeHold(tracker.hold)!.holdMs).toBe(300)
  })

  it('bridges gaps up to 150 ms', () => {
    const tracker = new HoldTracker()
    tracker.push({ tMs: 0, cents: 0, midi: 67, db: -20 })
    tracker.push({ tMs: 150, cents: 0, midi: 67, db: -20 })
    expect(tracker.hold).toHaveLength(2)
  })

  it('starts a new hold on a change of note', () => {
    const tracker = new HoldTracker()
    tracker.push({ tMs: 0, cents: 0, midi: 67, db: -20 })
    tracker.push({ tMs: 20, cents: 0, midi: 69, db: -20 })
    expect(tracker.hold.map((s) => s.midi)).toEqual([69])
  })
})
