import { describe, expect, it } from 'vitest'
import { MAX_SESSIONS, addPractice, addSession, emptyLog, sanitizeLog } from './logModel'

const session = (score: number) => ({ date: '2026-09-27', game: 'echo', score, max: 2000 })

describe('sanitizeLog', () => {
  it('turns anything that is not a log object into an empty log', () => {
    expect(sanitizeLog(null)).toEqual(emptyLog())
    expect(sanitizeLog('x')).toEqual(emptyLog())
    expect(sanitizeLog([1, 2])).toEqual(emptyLog())
    expect(sanitizeLog({ days: [], sessions: {} })).toEqual(emptyLog())
  })

  it('keeps valid days and drops bad dates, pages and amounts', () => {
    const raw = {
      days: {
        '2026-09-27': { tuner: 120, echo: '60', bend: -5, melody: Infinity, scales: 0 },
        '2026-9-1': { tuner: 10 },
        yesterday: { tuner: 10 },
        '2026-09-26': 'lots',
        '2026-09-25': { echo: 'x' },
      },
    }
    expect(sanitizeLog(raw)).toEqual({ days: { '2026-09-27': { tuner: 120 } }, sessions: [] })
  })

  it('keeps valid sessions, strips extra fields and keeps only the last 200', () => {
    const raw = {
      sessions: [
        { ...session(5), extra: true },
        { date: 'today', game: 'echo', score: 1, max: 2 },
        { date: '2026-09-27', game: '', score: 1, max: 2 },
        { date: '2026-09-27', game: 'echo', score: '1', max: 2 },
        null,
      ],
    }
    expect(sanitizeLog(raw).sessions).toEqual([session(5)])
    const many = { sessions: Array.from({ length: 250 }, (_, i) => session(i)) }
    const kept = sanitizeLog(many).sessions
    expect(kept).toHaveLength(MAX_SESSIONS)
    expect(kept[0].score).toBe(50)
    expect(kept[199].score).toBe(249)
  })
})

describe('addPractice', () => {
  it('adds seconds per day and page without mutating the log', () => {
    const empty = emptyLog()
    const once = addPractice(empty, '2026-09-27', 'tuner', 15)
    const twice = addPractice(once, '2026-09-27', 'tuner', 15)
    const other = addPractice(twice, '2026-09-27', 'echo', 7.25)
    expect(empty).toEqual(emptyLog())
    expect(once.days).toEqual({ '2026-09-27': { tuner: 15 } })
    expect(other.days).toEqual({ '2026-09-27': { tuner: 30, echo: 7.3 } })
  })
  it('ignores zero or negative amounts', () => {
    const log = emptyLog()
    expect(addPractice(log, '2026-09-27', 'tuner', 0)).toBe(log)
    expect(addPractice(log, '2026-09-27', 'tuner', -3)).toBe(log)
  })
})

describe('addSession', () => {
  it('appends and keeps only the last 200', () => {
    let log = emptyLog()
    for (let i = 0; i < MAX_SESSIONS; i++) log = addSession(log, session(i))
    log = addSession(log, session(999))
    expect(log.sessions).toHaveLength(MAX_SESSIONS)
    expect(log.sessions[0].score).toBe(1)
    expect(log.sessions[MAX_SESSIONS - 1].score).toBe(999)
  })
})
