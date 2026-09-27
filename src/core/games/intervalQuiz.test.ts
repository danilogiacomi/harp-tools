import { describe, expect, it } from 'vitest'
import { buildHarp } from '../harmonica/harp'
import { INTERVALS } from '../music/intervals'
import {
  answerPoints,
  intervalPairs,
  makeIntervalQuestion,
  playPoints,
  playRoundConfig,
} from './intervalQuiz'
import { DEFAULT_POOL_FILTER, buildPool, uniqueMidis } from './notePool'
import { scriptedRng } from './random'

// C harp, holes 1–10, blow/draw: 60 62 64 67 71 72 74 76 77 79 81 83 84 86 88 89 91 93 96
const pool = uniqueMidis(buildPool(buildHarp('C'), DEFAULT_POOL_FILTER, false))
const ALL = INTERVALS.map((i) => i.id)

describe('intervalPairs', () => {
  it('lists the low notes that have the interval above them in the pool', () => {
    expect(intervalPairs(pool, 1)).toEqual([71, 76, 83, 88])
    expect(intervalPairs(pool, 6)).toEqual([71, 77, 83])
  })
})

describe('makeIntervalQuestion', () => {
  it('picks an interval, then a low note that has it', () => {
    expect(makeIntervalQuestion(pool, ['m2'], scriptedRng([0, 0.5]))).toEqual({
      low: 83,
      high: 84,
      interval: INTERVALS[0],
    })
    expect(makeIntervalQuestion(pool, ['m2', 'P8'], scriptedRng([0.99, 0]))).toEqual({
      low: 60,
      high: 72,
      interval: INTERVALS[11],
    })
    expect(makeIntervalQuestion(pool, ALL, scriptedRng([0, 0]))).toMatchObject({
      low: 71,
      high: 72,
    })
  })

  it('returns null when no allowed interval fits the pool', () => {
    expect(makeIntervalQuestion([60, 62], ['P5'], scriptedRng([0]))).toBeNull()
    expect(makeIntervalQuestion(pool, [], scriptedRng([0]))).toBeNull()
    expect(makeIntervalQuestion([], ALL, scriptedRng([0]))).toBeNull()
  })
})

describe('interval scoring', () => {
  it('scores name answers by speed', () => {
    expect(answerPoints(true, 5000)).toBe(150)
    expect(answerPoints(false, 100)).toBe(0)
  })

  it('times play mode at 8 s when scored', () => {
    const matcher = { toleranceCents: 25, holdMs: 500 }
    expect(playRoundConfig('scored', matcher, 440)).toEqual({
      matcher,
      a4: 440,
      limitMs: 8000,
      helpAfterMs: null,
    })
    expect(playRoundConfig('practice', matcher, 440).limitMs).toBeNull()
    expect(
      playPoints({
        status: 'hit',
        progress: 1,
        cents: 0,
        elapsedMs: 2000,
        helpOffered: false,
        timeMs: 2000,
        stability: 1,
      }),
    ).toBe(175)
  })
})
