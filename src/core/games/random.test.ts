import { describe, expect, it } from 'vitest'
import { mulberry32, pickOne, scriptedRng, weightedIndex } from './random'

describe('mulberry32', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const values = Array.from({ length: 1000 }, () => a())
    expect(values).toEqual(Array.from({ length: 1000 }, () => b()))
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true)
    expect(new Set(values).size).toBeGreaterThan(990)
  })
})

describe('scriptedRng', () => {
  it('replays values in order and cycles', () => {
    const rng = scriptedRng([0.1, 0.9])
    expect([rng(), rng(), rng()]).toEqual([0.1, 0.9, 0.1])
  })
})

describe('pickOne', () => {
  it('maps the rng onto the list', () => {
    expect(pickOne(['a', 'b', 'c'], () => 0)).toBe('a')
    expect(pickOne(['a', 'b', 'c'], () => 0.5)).toBe('b')
    expect(pickOne(['a', 'b', 'c'], () => 0.999)).toBe('c')
  })
  it('throws on an empty list', () => {
    expect(() => pickOne([], () => 0)).toThrow()
  })
})

describe('weightedIndex', () => {
  it('picks by cumulative weight', () => {
    expect(weightedIndex([2, 4, 4, 2], () => 0)).toBe(0)
    expect(weightedIndex([2, 4, 4, 2], () => 0.4)).toBe(1) // 4.8 of 12
    expect(weightedIndex([2, 4, 4, 2], () => 0.9999)).toBe(3)
  })
})
