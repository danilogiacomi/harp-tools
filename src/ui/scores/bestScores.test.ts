import { describe, expect, it } from 'vitest'
import { BEST_SCORES_KEY, bestScoreKey, loadBest, saveBestIfHigher, tuningPart } from './bestScores'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial }
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v
    },
  }
}

describe('bestScoreKey', () => {
  it('combines the game with its settings in a stable order', () => {
    expect(bestScoreKey('echo', { tol: 25, key: 'C', pool: '1-10:plain', adv: false })).toBe(
      'echo|adv=false|key=C|pool=1-10:plain|tol=25',
    )
    expect(bestScoreKey('echo', { key: 'C', tol: 25 })).not.toBe(
      bestScoreKey('echo', { key: 'G', tol: 25 }),
    )
  })
})

describe('best scores', () => {
  it('has no best until one is saved', () => {
    expect(loadBest(memoryStorage(), 'echo|key=C')).toBeNull()
    expect(loadBest(null, 'echo|key=C')).toBeNull()
  })

  it('saves only higher scores, per key', () => {
    const s = memoryStorage()
    expect(saveBestIfHigher(s, 'echo|key=C', 900)).toBe(true)
    expect(saveBestIfHigher(s, 'echo|key=C', 700)).toBe(false)
    expect(saveBestIfHigher(s, 'echo|key=C', 900)).toBe(false)
    expect(saveBestIfHigher(s, 'echo|key=G', 100)).toBe(true)
    expect(loadBest(s, 'echo|key=C')).toBe(900)
    expect(loadBest(s, 'echo|key=G')).toBe(100)
    expect(JSON.parse(s.data[BEST_SCORES_KEY])).toEqual({ 'echo|key=C': 900, 'echo|key=G': 100 })
  })

  it('treats corrupt or hand-edited storage as empty', () => {
    expect(loadBest(memoryStorage({ [BEST_SCORES_KEY]: '{nope' }), 'k')).toBeNull()
    expect(loadBest(memoryStorage({ [BEST_SCORES_KEY]: '[1,2]' }), '0')).toBeNull()
    expect(loadBest(memoryStorage({ [BEST_SCORES_KEY]: '{"k":"900"}' }), 'k')).toBeNull()
    expect(loadBest(memoryStorage({ [BEST_SCORES_KEY]: '{"k":-5}' }), 'k')).toBeNull()
    const s = memoryStorage({ [BEST_SCORES_KEY]: '{nope' })
    expect(saveBestIfHigher(s, 'k', 10)).toBe(true)
    expect(loadBest(s, 'k')).toBe(10)
  })

  it('survives storage that throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(loadBest(throwing, 'k')).toBeNull()
    expect(saveBestIfHigher(throwing, 'k', 10)).toBe(false)
    expect(saveBestIfHigher(null, 'k', 10)).toBe(false)
  })
})

describe('tuningPart', () => {
  it('leaves Richter keys exactly as before, so saved bests survive', () => {
    expect(bestScoreKey('echo', { key: 'C', tol: 25, ...tuningPart('richter') })).toBe(
      'echo|key=C|tol=25',
    )
  })
  it('adds the tuning for the other tunings', () => {
    expect(bestScoreKey('echo', { key: 'C', tol: 25, ...tuningPart('paddy') })).toBe(
      'echo|key=C|tol=25|tuning=paddy',
    )
    expect(bestScoreKey('quiz', { key: 'G', ...tuningPart('naturalMinor') })).toBe(
      'quiz|key=G|tuning=naturalMinor',
    )
  })
})
