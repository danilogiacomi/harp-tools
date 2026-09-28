import { describe, expect, it } from 'vitest'
import {
  SCORED_ROUNDS,
  correctCount,
  isFinished,
  maxScore,
  recordRound,
  roundPoints,
  sessionScore,
  speedBonus,
  startSession,
} from './session'

describe('speedBonus', () => {
  it('runs from 2 (instant) down to 1 (at or after the limit)', () => {
    expect(speedBonus(0, 8000)).toBe(2)
    expect(speedBonus(4000, 8000)).toBe(1.5)
    expect(speedBonus(8000, 8000)).toBe(1)
    expect(speedBonus(9000, 8000)).toBe(1)
  })
  it('is 1 without a usable limit', () => {
    expect(speedBonus(100, 0)).toBe(1)
  })
})

describe('roundPoints', () => {
  it('is 100 × accuracy × bonus, rounded', () => {
    expect(roundPoints(1, 1.5)).toBe(150)
    expect(roundPoints(0.6, 1.25)).toBe(75)
    expect(roundPoints(0, 2)).toBe(0)
  })
  it('clamps accuracy to 0–1', () => {
    expect(roundPoints(1.4, 1)).toBe(100)
    expect(roundPoints(-1, 2)).toBe(0)
  })
})

describe('scored session', () => {
  it('has 10 rounds, sums points and then stops recording', () => {
    let s = startSession('scored')
    expect(s.totalRounds).toBe(SCORED_ROUNDS)
    expect(maxScore(s)).toBe(2000)
    for (let i = 0; i < 10; i++) {
      expect(isFinished(s)).toBe(false)
      s = recordRound(s, { correct: i % 2 === 0, points: i % 2 === 0 ? 150 : 0 })
    }
    expect(isFinished(s)).toBe(true)
    expect(sessionScore(s)).toBe(750)
    expect(correctCount(s)).toBe(5)
    expect(recordRound(s, { correct: true, points: 200 })).toBe(s)
  })

  it('can have a custom length', () => {
    let s = startSession('scored', 3)
    s = recordRound(s, { correct: true, points: 100 })
    s = recordRound(s, { correct: true, points: 100 })
    expect(isFinished(s)).toBe(false)
    s = recordRound(s, { correct: true, points: 100 })
    expect(isFinished(s)).toBe(true)
    expect(maxScore(s)).toBe(600)
  })

  it('can cap rounds at fewer points (rhythm hits are worth up to 100)', () => {
    const s = startSession('scored', 32, 100)
    expect(s.roundMax).toBe(100)
    expect(maxScore(s)).toBe(3200)
  })
})

describe('practice session', () => {
  it('never finishes and scores nothing, but counts correct rounds', () => {
    let s = startSession('practice')
    for (let i = 0; i < 25; i++) s = recordRound(s, { correct: true, points: 180 })
    expect(isFinished(s)).toBe(false)
    expect(sessionScore(s)).toBe(0)
    expect(correctCount(s)).toBe(25)
  })
})
