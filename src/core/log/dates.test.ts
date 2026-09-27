import { describe, expect, it } from 'vitest'
import { addDays, localDate, secondsByDay, weekStart } from './dates'

const at = (y: number, m: number, d: number, h = 0, min = 0, s = 0) =>
  new Date(y, m - 1, d, h, min, s).getTime()

describe('localDate', () => {
  it('formats the local calendar date', () => {
    expect(localDate(at(2026, 9, 27, 23, 59, 59))).toBe('2026-09-27')
    expect(localDate(at(2026, 1, 5))).toBe('2026-01-05')
  })
})

describe('addDays', () => {
  it('crosses month, year and leap-day boundaries', () => {
    expect(addDays('2026-09-27', 1)).toBe('2026-09-28')
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-09-27', -13)).toBe('2026-09-14')
  })
})

describe('weekStart', () => {
  it('is the Monday of the same week', () => {
    expect(weekStart('2026-09-27')).toBe('2026-09-21') // Sunday
    expect(weekStart('2026-09-21')).toBe('2026-09-21') // Monday
    expect(weekStart('2026-09-23')).toBe('2026-09-21')
    expect(weekStart('2026-10-01')).toBe('2026-09-28')
  })
})

describe('secondsByDay', () => {
  it('keeps a span within one day in one piece', () => {
    expect(secondsByDay(at(2026, 9, 27, 10), at(2026, 9, 27, 10, 0, 15))).toEqual([
      { date: '2026-09-27', seconds: 15 },
    ])
  })
  it('splits a span at local midnight', () => {
    expect(secondsByDay(at(2026, 9, 27, 23, 59, 50), at(2026, 9, 28, 0, 0, 20))).toEqual([
      { date: '2026-09-27', seconds: 10 },
      { date: '2026-09-28', seconds: 20 },
    ])
  })
  it('returns nothing for empty or backwards spans', () => {
    expect(secondsByDay(1000, 1000)).toEqual([])
    expect(secondsByDay(2000, 1000)).toEqual([])
  })
})
