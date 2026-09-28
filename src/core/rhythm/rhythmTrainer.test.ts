import { describe, expect, it } from 'vitest'
import { midiToFreq } from '../music/pitch'
import {
  GRADE_POINTS,
  OnsetDetector,
  RHYTHM_PATTERNS,
  RhythmSession,
  averageOffset,
  bpmBucket,
  gradeOffset,
  patternById,
  type RhythmHit,
} from './rhythmTrainer'

const G4 = midiToFreq(67)
const A4 = midiToFreq(69)

describe('RHYTHM_PATTERNS', () => {
  it('defines one bar of each pattern', () => {
    expect(RHYTHM_PATTERNS.map((p) => [p.id, p.onsets.length])).toEqual([
      ['quarters', 4],
      ['eighths', 8],
      ['shuffle', 8],
      ['offbeats', 4],
      ['charleston', 2],
      ['train', 8],
    ])
    expect(patternById('shuffle').onsets[1]).toBeCloseTo(0.667, 3)
    expect(patternById('shuffle').onsets[7]).toBeCloseTo(3.667, 3)
    expect(patternById('offbeats').onsets).toEqual([0.5, 1.5, 2.5, 3.5])
    expect(patternById('charleston').onsets).toEqual([0, 1.5])
    expect(patternById('train').accents).toEqual([0, 2])
  })
})

describe('gradeOffset', () => {
  it('grades by distance from the beat', () => {
    expect([0, 40, -41, 100, 101, -250].map(gradeOffset)).toEqual([
      'perfect',
      'perfect',
      'good',
      'good',
      'off',
      'off',
    ])
    expect(GRADE_POINTS).toEqual({ perfect: 100, good: 70, off: 30, miss: 0 })
  })
})

describe('OnsetDetector', () => {
  it('finds a note after 80 ms without one, timestamped 60 ms early', () => {
    const d = new OnsetDetector()
    expect(d.push(G4, 1000)).toBe(940)
    expect(d.push(G4, 1016)).toBeNull()
    expect(d.push(null, 1032)).toBeNull()
    expect(d.push(G4, 1080)).toBeNull() // 64 ms since the last pitched reading
    expect(d.push(G4, 1200)).toBe(1140) // 120 ms
  })

  it('counts a change of note as an onset, but not a flicker', () => {
    const d = new OnsetDetector()
    d.push(G4, 0)
    expect(d.push(A4, 150)).toBe(90)
    expect(d.push(G4, 166)).toBeNull() // 16 ms after the last onset
  })
})

/** Feeds `freq` (null = silence) every 10 ms from `from` to `to`; collects the resolved hits. */
function feed(s: RhythmSession, from: number, to: number, freq: number | null): RhythmHit[] {
  const hits: RhythmHit[] = []
  for (let t = from; t <= to; t += 10) hits.push(...s.push(freq, t))
  return hits
}
/** A 150 ms note whose onset (after latency) is at `onsetMs`, then silence until `untilMs`. */
function note(s: RhythmSession, onsetMs: number, untilMs: number): RhythmHit[] {
  const start = onsetMs + 60
  return [...feed(s, start, start + 150, G4), ...feed(s, start + 160, untilMs, null)]
}

describe('RhythmSession', () => {
  // 120 BPM: a beat every 500 ms. Metronome beat 0 heard at 1000 → count-in bar 1000–2999,
  // first hit at 3000.
  const session = (bars: number | null, id: 'quarters' | 'charleston' = 'quarters') => {
    const s = new RhythmSession({
      pattern: patternById(id),
      bpm: 120,
      countInBars: 1,
      bars,
      a4: 440,
    })
    s.syncBeat(1000)
    return s
  }

  it('computes the expected hits after the count-in', () => {
    const s = session(1, 'charleston')
    expect([0, 1, 2].map((i) => s.expectedMs(i))).toEqual([3000, 3750, 5000])
  })

  it('grades each hit and times out the ones never played', () => {
    const s = session(1)
    const hits = [
      ...feed(s, 2000, 3000, null),
      ...note(s, 3020, 3400),
      ...note(s, 3430, 3900),
      ...note(s, 4180, 4900),
    ]
    expect(hits.map((h) => [h.index, h.grade, h.offsetMs])).toEqual([
      [0, 'perfect', 20],
      [1, 'good', -70],
      [2, 'off', 180],
      [3, 'miss', null],
    ])
    expect(s.done).toBe(true)
    expect(s.totalHits).toBe(4)
  })

  it('ignores onsets too far from any hit, and extra onsets near a hit already taken', () => {
    const s = session(1)
    const hits = [
      ...note(s, 2600, 2950), // 400 ms before the first hit
      ...note(s, 3000, 3200),
      ...note(s, 3220, 3440), // 220 ms after hit 0 (taken), 280 ms before hit 1
    ]
    expect(hits.map((h) => [h.index, h.grade])).toEqual([[0, 'perfect']])
  })

  it('ignores the mic until the metronome has been heard', () => {
    const s = new RhythmSession({
      pattern: patternById('quarters'),
      bpm: 120,
      countInBars: 1,
      bars: 1,
      a4: 440,
    })
    expect(note(s, 3000, 3300)).toEqual([])
    expect(s.expectedMs(0)).toBeNull()
  })

  it('keeps going in practice', () => {
    const s = session(null)
    expect(s.totalHits).toBeNull()
    const hits = feed(s, 2000, 9000, null)
    expect(hits.map((h) => h.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(s.done).toBe(false)
  })
})

describe('averageOffset', () => {
  const hit = (offsetMs: number | null): RhythmHit => ({
    index: 0,
    bar: 0,
    beat: 0,
    expectedMs: 0,
    offsetMs,
    grade: offsetMs === null ? 'miss' : gradeOffset(offsetMs),
  })
  it('averages the hits that landed', () => {
    expect(averageOffset([hit(20), hit(40), hit(null)])).toBe(30)
    expect(averageOffset([hit(null)])).toBeNull()
  })
})

describe('bpmBucket', () => {
  it('rounds to the nearest 10 BPM', () => {
    expect([84, 85, 90, 96].map(bpmBucket)).toEqual([80, 90, 90, 100])
  })
})
