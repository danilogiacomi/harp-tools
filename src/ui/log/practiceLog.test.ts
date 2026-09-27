import { describe, expect, it } from 'vitest'
import { emptyLog } from '../../core/log/logModel'
import { LOG_KEY, appendSession, clearLog, loadLog, recordPractice, saveLog } from './practiceLog'

function memoryStorage(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initial }
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v
    },
    removeItem: (k: string) => {
      delete data[k]
    },
  }
}

const throwing = {
  getItem: () => {
    throw new Error('SecurityError')
  },
  setItem: () => {
    throw new Error('QuotaExceededError')
  },
  removeItem: () => {
    throw new Error('SecurityError')
  },
}

const at = (h: number, m: number, s: number, day = 27) => new Date(2026, 8, day, h, m, s).getTime()

describe('loadLog', () => {
  it('is empty without storage, without data, or for corrupt data', () => {
    expect(loadLog(null)).toEqual(emptyLog())
    expect(loadLog(memoryStorage())).toEqual(emptyLog())
    expect(loadLog(memoryStorage({ [LOG_KEY]: '{nope' }))).toEqual(emptyLog())
    expect(loadLog(memoryStorage({ [LOG_KEY]: '[1,2,3]' }))).toEqual(emptyLog())
    expect(loadLog(throwing)).toEqual(emptyLog())
  })
  it('repairs what it can', () => {
    const s = memoryStorage({
      [LOG_KEY]: JSON.stringify({ days: { '2026-09-27': { tuner: 30, echo: 'x' } } }),
    })
    expect(loadLog(s)).toEqual({ days: { '2026-09-27': { tuner: 30 } }, sessions: [] })
  })
})

describe('recordPractice', () => {
  it('adds a span to the day it happened in', () => {
    const s = memoryStorage()
    recordPractice(s, 'tuner', at(10, 0, 0), at(10, 0, 15))
    recordPractice(s, 'tuner', at(10, 0, 15), at(10, 0, 30))
    expect(loadLog(s).days).toEqual({ '2026-09-27': { tuner: 30 } })
  })
  it('splits a span that crosses midnight', () => {
    const s = memoryStorage()
    recordPractice(s, 'echo', at(23, 59, 50), at(0, 0, 5, 28))
    expect(loadLog(s).days).toEqual({
      '2026-09-27': { echo: 10 },
      '2026-09-28': { echo: 5 },
    })
  })
  it('never throws, even when storage does', () => {
    expect(() => recordPractice(throwing, 'tuner', at(10, 0, 0), at(10, 0, 15))).not.toThrow()
    expect(() => recordPractice(null, 'tuner', at(10, 0, 0), at(10, 0, 15))).not.toThrow()
  })
})

describe('appendSession', () => {
  it('stamps the local date and appends the session', () => {
    const s = memoryStorage()
    appendSession(s, { game: 'echo', score: 1450, max: 2000 }, at(21, 0, 0))
    expect(loadLog(s).sessions).toEqual([
      { date: '2026-09-27', game: 'echo', score: 1450, max: 2000 },
    ])
  })
  it('never throws, even when storage does', () => {
    expect(() => appendSession(throwing, { game: 'echo', score: 1, max: 2 }, 0)).not.toThrow()
  })
})

describe('saveLog and clearLog', () => {
  it('report a failed write and tolerate storage that throws', () => {
    expect(saveLog(throwing, emptyLog())).toBe(false)
    expect(saveLog(null, emptyLog())).toBe(false)
    expect(() => clearLog(throwing)).not.toThrow()
  })
  it('clear the whole log', () => {
    const s = memoryStorage()
    expect(saveLog(s, { days: { '2026-09-27': { tuner: 5 } }, sessions: [] })).toBe(true)
    clearLog(s)
    expect(s.data[LOG_KEY]).toBeUndefined()
    expect(loadLog(s)).toEqual(emptyLog())
  })
})
