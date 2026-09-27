import { describe, expect, it } from 'vitest'
import { ActiveClock } from './activeClock'

describe('ActiveClock', () => {
  it('has nothing to report while stopped', () => {
    const clock = new ActiveClock()
    expect(clock.running).toBe(false)
    expect(clock.flush(1000)).toBeNull()
    expect(clock.stop(1000)).toBeNull()
  })

  it('hands out the time since the last flush, and nothing once stopped', () => {
    const clock = new ActiveClock()
    clock.start(1000)
    expect(clock.flush(16000)).toEqual({ startMs: 1000, endMs: 16000 })
    expect(clock.flush(31000)).toEqual({ startMs: 16000, endMs: 31000 })
    expect(clock.stop(35000)).toEqual({ startMs: 31000, endMs: 35000 })
    expect(clock.running).toBe(false)
    expect(clock.flush(40000)).toBeNull()
  })

  it('ignores start() while already running', () => {
    const clock = new ActiveClock()
    clock.start(0)
    clock.start(5000)
    expect(clock.stop(10000)).toEqual({ startMs: 0, endMs: 10000 })
  })

  it('counts at most the last 30 s of a long gap (the computer slept)', () => {
    const clock = new ActiveClock()
    clock.start(0)
    expect(clock.flush(3_600_000)).toEqual({ startMs: 3_570_000, endMs: 3_600_000 })
  })

  it('survives the clock going backwards', () => {
    const clock = new ActiveClock()
    clock.start(10000)
    expect(clock.flush(5000)).toBeNull()
    expect(clock.flush(8000)).toEqual({ startMs: 5000, endMs: 8000 })
  })
})
