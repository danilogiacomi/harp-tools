import { describe, expect, it } from 'vitest'
import { mean, median, stdDev } from './stats'

describe('stats', () => {
  it('mean', () => {
    expect(mean([1, 2, 6])).toBe(3)
  })

  it('median takes the middle value, or the mean of the two middle ones', () => {
    expect(median([5, 1, 3])).toBe(3)
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })

  it('stdDev is the population σ', () => {
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2)
    expect(stdDev([3, 3, 3])).toBe(0)
  })

  it('refuses an empty list', () => {
    expect(() => mean([])).toThrow()
    expect(() => median([])).toThrow()
  })
})
