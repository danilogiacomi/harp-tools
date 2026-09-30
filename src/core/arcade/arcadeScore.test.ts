import { describe, expect, it } from 'vitest'
import type { GameMode } from '../games/session'
import type { JudgedNote } from '../tab/tabJudge'
import {
  basePoints,
  gradeOf,
  maxScore,
  meterLevel,
  multiplier,
  scoreNote,
  starText,
  stars,
  startArcade,
  type ArcadeState,
} from './arcadeScore'

const hit = (offsetMs: number): JudgedNote => ({ index: 0, hit: true, offsetMs, points: 0 })
const miss: JudgedNote = { index: 0, hit: false, offsetMs: null, points: 0 }
const times = (n: number, note: JudgedNote) => Array.from({ length: n }, () => note)
/** Scores `notes` one by one, from a fresh run unless told otherwise. */
const play = (notes: JudgedNote[], mode: GameMode = 'scored', from = startArcade()) =>
  notes.reduce<ArcadeState>((s, n) => scoreNote(s, n, mode).state, from)

describe('grades', () => {
  it('is Perfect within ±50 ms, Good to ±150 ms, and Miss otherwise', () => {
    expect([0, 50, -50, 51, -150, 150].map((o) => gradeOf(hit(o)))).toEqual([
      'perfect',
      'perfect',
      'perfect',
      'good',
      'good',
      'good',
    ])
    expect(gradeOf(miss)).toBe('miss')
  })

  it('gives 100 for a Perfect and 50–99 for a Good', () => {
    expect([0, 50, 51, 100, 150].map((o) => basePoints(hit(o)))).toEqual([100, 100, 99, 75, 50])
    expect(basePoints(miss)).toBe(0)
  })
})

describe('combo and multiplier', () => {
  it('steps up every 10 notes in a row, up to ×4', () => {
    expect([0, 9, 10, 19, 20, 29, 30, 99].map(multiplier)).toEqual([1, 1, 2, 2, 3, 3, 4, 4])
  })

  it('multiplies each note by the combo before it, and a miss resets the combo', () => {
    const ten = play(times(10, hit(0)))
    expect(ten).toMatchObject({ score: 1000, combo: 10, longest: 10 })
    const step = scoreNote(ten, hit(100), 'scored')
    expect(step).toMatchObject({ grade: 'good', points: 150 }) // 75 × 2
    const after = play([miss, hit(0)], 'scored', step.state)
    expect(after).toMatchObject({ score: 1250, combo: 1, longest: 11 })
    expect(after.counts).toEqual({ perfect: 11, good: 1, miss: 1 })
  })

  it('knows the most a song can score', () => {
    expect([0, 9, 10, 35].map(maxScore)).toEqual([0, 900, 1000, 8000])
  })
})

describe('rock meter', () => {
  it('starts half full: +3 a Perfect, +2 a Good, −8 a Miss, within 0–100', () => {
    expect(startArcade().meter).toBe(50)
    expect(play([hit(0), hit(100)]).meter).toBe(55)
    expect(play([miss]).meter).toBe(42)
    expect(play(times(30, hit(0))).meter).toBe(100)
  })

  it('fails a scored run when it runs out, and stays failed', () => {
    const six = play(times(6, miss))
    expect(six).toMatchObject({ meter: 2, failed: false })
    const failed = play([miss], 'scored', six)
    expect(failed).toMatchObject({ meter: 0, failed: true })
    expect(play([hit(0)], 'scored', failed).failed).toBe(true)
  })

  it('never fails in practice, and fills again from empty', () => {
    const empty = play(times(10, miss), 'practice')
    expect(empty).toMatchObject({ meter: 0, failed: false })
    expect(play([hit(0)], 'practice', empty).meter).toBe(3)
  })

  it('is low below 25, mid below 50, high from 50', () => {
    expect([0, 24, 25, 49, 50, 100].map(meterLevel)).toEqual([
      'low',
      'low',
      'mid',
      'mid',
      'high',
      'high',
    ])
  })
})

describe('stars', () => {
  it('gives one for finishing, and more at 40, 60, 80 and 95 %', () => {
    expect([0, 399, 400, 599, 600, 800, 949, 950, 1000].map((s) => stars(s, 1000))).toEqual([
      1, 1, 2, 2, 3, 4, 4, 5, 5,
    ])
  })

  it('gives none without a score', () => {
    expect(stars(null, 1000)).toBe(0)
    expect(stars(0, 0)).toBe(0)
  })

  it('draws filled and empty stars', () => {
    expect(starText(3)).toBe('★★★☆☆')
    expect(starText(0)).toBe('☆☆☆☆☆')
  })
})
