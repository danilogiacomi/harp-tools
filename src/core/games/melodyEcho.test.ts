import { describe, expect, it } from 'vitest'
import { buildHarp } from '../harmonica/harp'
import { midiToFreq } from '../music/pitch'
import {
  MelodyRound,
  generatePhrase,
  melodyPoints,
  nextPhraseLength,
  type MelodyState,
} from './melodyEcho'
import { DEFAULT_POOL_FILTER, buildPool, uniqueMidis } from './notePool'
import { mulberry32, scriptedRng } from './random'

describe('generatePhrase', () => {
  it('walks the pool in small weighted steps', () => {
    // start: floor(0.5 × 5) = index 2 (64)
    // from 2: j0 w2, j1 w4, j3 w4, j4 w2 (total 12); 0.4 × 12 = 4.8 → j1 (62)
    // from 1: j0 w4, j2 w4, j3 w2, j4 w1 (total 11); 0.9 × 11 = 9.9 → j3 (65)
    expect(generatePhrase([60, 62, 64, 65, 67], 3, scriptedRng([0.5, 0.4, 0.9]))).toEqual([
      64, 62, 65,
    ])
  })

  it('never repeats a note and prefers steps of one', () => {
    const pool = uniqueMidis(buildPool(buildHarp('C'), DEFAULT_POOL_FILTER, false))
    const rng = mulberry32(7)
    const counts = [0, 0, 0, 0]
    for (let i = 0; i < 500; i++) {
      const phrase = generatePhrase(pool, 5, rng)
      expect(phrase).toHaveLength(5)
      for (let k = 1; k < phrase.length; k++) {
        const d = Math.abs(pool.indexOf(phrase[k]) - pool.indexOf(phrase[k - 1]))
        expect(d).toBeGreaterThanOrEqual(1)
        expect(d).toBeLessThanOrEqual(3)
        counts[d]++
      }
    }
    expect(counts[1]).toBeGreaterThan(counts[2])
    expect(counts[2]).toBeGreaterThan(counts[3])
  })

  it('copes with tiny pools', () => {
    expect(generatePhrase([60], 3, scriptedRng([0.3]))).toEqual([60, 60, 60])
    expect(generatePhrase([], 3, scriptedRng([0.3]))).toEqual([])
  })
})

describe('nextPhraseLength', () => {
  it('grows after a success up to 5 and holds after a miss', () => {
    expect(nextPhraseLength(2, true)).toBe(3)
    expect(nextPhraseLength(5, true)).toBe(5)
    expect(nextPhraseLength(4, false)).toBe(4)
  })
})

describe('MelodyRound', () => {
  const CONFIG = { matcher: { toleranceCents: 25, holdMs: 250 }, a4: 440 }
  const play = (r: MelodyRound, midi: number, from: number, to: number) => {
    let last = r.state
    for (let t = from; t <= to; t += 50) last = r.push(midiToFreq(midi), t)
    return last
  }

  it('succeeds when every note is played in order', () => {
    const r = new MelodyRound([60, 62, 64], CONFIG, 0, null)
    expect(play(r, 60, 0, 250).index).toBe(1)
    expect(play(r, 62, 300, 550).index).toBe(2)
    expect(play(r, 64, 600, 850)).toMatchObject({ status: 'success', index: 3, elapsedMs: 850 })
  })

  it('lets the previous note ring on, then flags a held wrong note', () => {
    const r = new MelodyRound([60, 62, 64], CONFIG, 0, null)
    play(r, 60, 0, 250)
    expect(play(r, 60, 300, 600).status).toBe('listening')
    expect(play(r, 65, 650, 850).status).toBe('listening')
    expect(r.push(midiToFreq(65), 900)).toMatchObject({
      status: 'wrong',
      index: 1,
      wrongIndex: 1,
      wrongMidi: 65,
    })
  })

  it('ignores a brief stray pitch', () => {
    const r = new MelodyRound([60, 62, 64], CONFIG, 0, null)
    play(r, 60, 0, 250)
    play(r, 65, 300, 500)
    expect(play(r, 62, 550, 800)).toMatchObject({ status: 'listening', index: 2, wrongIndex: null })
  })

  it('times out at the limit', () => {
    const r = new MelodyRound([60, 62, 64], CONFIG, 0, 9000)
    expect(r.push(null, 8999).status).toBe('listening')
    expect(r.push(null, 9000).status).toBe('timeout')
  })
})

describe('melodyPoints', () => {
  const state = (patch: Partial<MelodyState>): MelodyState => ({
    status: 'listening',
    index: 0,
    progress: 0,
    wrongIndex: null,
    wrongMidi: null,
    elapsedMs: 0,
    ...patch,
  })
  it('gives full accuracy with a speed bonus for a correct phrase', () => {
    // 1 + (1 − 850 / 9000) = 1.9056 → 191
    expect(melodyPoints(state({ status: 'success', index: 3, elapsedMs: 850 }), 3)).toBe(191)
  })
  it('gives partial credit for the notes before the mistake', () => {
    expect(melodyPoints(state({ status: 'wrong', index: 1, wrongIndex: 1 }), 3)).toBe(33)
    expect(melodyPoints(state({ status: 'timeout', index: 0 }), 3)).toBe(0)
  })
})
