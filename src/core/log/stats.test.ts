import { describe, expect, it } from 'vitest'
import { emptyLog, type PracticeLog } from './logModel'
import {
  dailySeconds,
  dayTotal,
  formatDuration,
  pageSecondsThisWeek,
  recentSessions,
  streaks,
  totals,
} from './stats'

const TODAY = '2026-09-27' // a Sunday
const logOf = (days: Record<string, Record<string, number>>): PracticeLog => ({
  days,
  sessions: [],
})
const everyDay = (dates: string[], seconds = 60) =>
  logOf(Object.fromEntries(dates.map((d) => [d, { tuner: seconds }])))

describe('streaks', () => {
  it('is zero for an empty log', () => {
    expect(streaks(emptyLog(), TODAY)).toEqual({ current: 0, longest: 0 })
  })
  it('counts consecutive days ending today', () => {
    expect(streaks(everyDay(['2026-09-25', '2026-09-26', '2026-09-27']), TODAY)).toEqual({
      current: 3,
      longest: 3,
    })
  })
  it('still counts a streak that ended yesterday (today is not over yet)', () => {
    expect(streaks(everyDay(['2026-09-24', '2026-09-25', '2026-09-26'], 120), TODAY)).toEqual({
      current: 3,
      longest: 3,
    })
  })
  it('breaks the current streak after a missed day, but remembers the longest', () => {
    expect(streaks(everyDay(['2026-09-24', '2026-09-25']), TODAY)).toEqual({
      current: 0,
      longest: 2,
    })
    const gap = everyDay([
      '2026-09-20',
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-26',
      TODAY,
    ])
    expect(streaks(gap, TODAY)).toEqual({ current: 2, longest: 4 })
  })
  it('needs at least 60 s in a day, summed over pages', () => {
    const log = logOf({
      '2026-09-25': { tuner: 60 },
      '2026-09-26': { tuner: 59 },
      [TODAY]: { tuner: 30, echo: 30 },
    })
    expect(streaks(log, TODAY)).toEqual({ current: 1, longest: 1 })
  })
  it('runs across the end of a month', () => {
    expect(streaks(everyDay(['2026-09-30', '2026-10-01']), '2026-10-01').current).toBe(2)
  })
})

const WEEK = logOf({
  [TODAY]: { tuner: 100, echo: 50 },
  '2026-09-21': { bend: 200 }, // Monday of this week
  '2026-09-20': { melody: 1000 }, // last Sunday
})

describe('totals', () => {
  it('sums today, this week (from Monday) and all time', () => {
    expect(dayTotal(WEEK, TODAY)).toBe(150)
    expect(totals(WEEK, TODAY)).toEqual({ today: 150, week: 350, all: 1350 })
  })
})

describe('dailySeconds', () => {
  it('lists the last 14 days, oldest first, with zero for days off', () => {
    const days = dailySeconds(WEEK, TODAY)
    expect(days).toHaveLength(14)
    expect(days[0]).toEqual({ date: '2026-09-14', seconds: 0 })
    expect(days[6]).toEqual({ date: '2026-09-20', seconds: 1000 })
    expect(days[7]).toEqual({ date: '2026-09-21', seconds: 200 })
    expect(days[13]).toEqual({ date: TODAY, seconds: 150 })
  })
})

describe('pageSecondsThisWeek', () => {
  it('sums each page over this week, most practised first', () => {
    expect(pageSecondsThisWeek(WEEK, TODAY)).toEqual([
      { pageId: 'bend', seconds: 200 },
      { pageId: 'tuner', seconds: 100 },
      { pageId: 'echo', seconds: 50 },
    ])
  })
})

describe('recentSessions', () => {
  it('returns the last 10, newest first', () => {
    const log: PracticeLog = {
      days: {},
      sessions: Array.from({ length: 12 }, (_, i) => ({
        date: TODAY,
        game: 'echo',
        score: i,
        max: 2000,
      })),
    }
    expect(recentSessions(log).map((s) => s.score)).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2])
  })
})

describe('formatDuration', () => {
  it('uses seconds, then minutes, then hours and minutes', () => {
    expect(formatDuration(0)).toBe('0 s')
    expect(formatDuration(45)).toBe('45 s')
    expect(formatDuration(59.6)).toBe('1 min')
    expect(formatDuration(754)).toBe('12 min')
    expect(formatDuration(3600)).toBe('1 h 00 min')
    expect(formatDuration(3900)).toBe('1 h 05 min')
    expect(formatDuration(37000)).toBe('10 h 16 min')
  })
})
