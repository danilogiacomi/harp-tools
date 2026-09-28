import { describe, expect, it } from 'vitest'
import { midiToFreq } from '../music/pitch'
import {
  TabJudge,
  WaitClock,
  requiredHoldMs,
  tabNotePoints,
  timingFactor,
  type JudgedNote,
} from './tabJudge'

describe('timing', () => {
  it('needs min(250 ms, 60 % of the note)', () => {
    expect(requiredHoldMs(1000)).toBe(250)
    expect(requiredHoldMs(250)).toBe(150)
  })

  it('gives full credit within ±50 ms, half at ±150 ms, none beyond', () => {
    expect([0, 50, -50, 100, -150, 151].map(timingFactor)).toEqual([1, 1, 1, 0.75, 0.5, 0])
    expect(tabNotePoints(100)).toBe(75)
  })
})

/** Feeds `midi` (null = silence) every 10 ms from `from` to `to`, song time. */
function feed(j: TabJudge, from: number, to: number, midi: number | null): JudgedNote[] {
  const out: JudgedNote[] = []
  for (let t = from; t <= to; t += 10)
    out.push(...j.push(midi === null ? null : midiToFreq(midi), t))
  return out
}
const judge = (notes: [number, number, number][]) =>
  new TabJudge(
    notes.map(([midi, startMs, durationMs]) => ({ midi, startMs, durationMs })),
    { toleranceCents: 25, a4: 440 },
  )

describe('TabJudge', () => {
  // Readings arrive 60 ms after the sound (detection latency), so playing a note that starts at
  // `s` means readings from s + 60.
  it('scores a note by how close its start was', () => {
    const j = judge([
      [72, 0, 500],
      [74, 500, 500],
      [76, 1000, 500],
    ])
    const out = [
      ...feed(j, 60, 400, 72), // on time
      ...feed(j, 410, 660, null),
      ...feed(j, 660, 950, 74), // starts at 600: 100 ms late
      ...feed(j, 1160, 1500, 76), // starts at 1100: 100 ms late
    ]
    expect(out).toEqual([
      { index: 0, hit: true, offsetMs: 0, points: 100 },
      { index: 1, hit: true, offsetMs: 100, points: 75 },
      { index: 2, hit: true, offsetMs: 100, points: 75 },
    ])
    expect(j.done).toBe(true)
  })

  it('misses a note played too late, too short or not at all', () => {
    const j = judge([
      [72, 0, 500],
      [74, 500, 500],
      [76, 1000, 500],
    ])
    const out = [
      ...feed(j, 260, 500, 72), // starts at 200: outside ±150 ms
      ...feed(j, 560, 700, 74), // held 140 ms of the 250 needed
      ...feed(j, 710, 1400, null),
    ]
    expect(out.map((n) => [n.index, n.hit])).toEqual([
      [0, false],
      [1, false],
      [2, false],
    ])
  })

  it('accepts a wrong note before the right one, if the right one starts in time', () => {
    const j = judge([[72, 0, 500]])
    expect([...feed(j, 0, 100, 74), ...feed(j, 110, 400, 72)]).toEqual([
      { index: 0, hit: true, offsetMs: 50, points: 100 },
    ])
  })

  it('counts a repeated pitch that is still sounding as played on time', () => {
    // Mary Had a Little Lamb's "E E E": the mic hears one long E.
    const j = judge([
      [76, 0, 500],
      [76, 500, 500],
      [76, 1000, 1000],
    ])
    expect(feed(j, 60, 1400, 76).map((n) => [n.index, n.hit, n.offsetMs])).toEqual([
      [0, true, 0],
      [1, true, 0],
      [2, true, 0],
    ])
  })

  it('shortens the hold for fast notes', () => {
    const j = judge([[72, 0, 200]]) // needs 120 ms
    expect(feed(j, 60, 180, 72)).toEqual([{ index: 0, hit: true, offsetMs: 0, points: 100 }])
  })
})

describe('WaitClock', () => {
  it('moves at tempo, stops at the awaited note and carries on once it is played', () => {
    const c = new WaitClock(1000, 500)
    expect(c.position(1000, 4)).toBe(0)
    expect(c.position(2000, 4)).toBe(2)
    expect(c.position(4000, 4)).toBe(4)
    c.release(4000, 4)
    expect(c.position(4500, 5)).toBe(5)
    expect(c.position(4250, 5)).toBe(4.5)
  })
})
