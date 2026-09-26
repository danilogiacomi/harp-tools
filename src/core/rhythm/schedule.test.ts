import { describe, expect, it } from 'vitest'
import {
  TIME_SIGNATURES,
  accentKind,
  scheduleAhead,
  type MetronomeConfig,
  type SchedulerState,
} from './schedule'

const sig = (label: string) => TIME_SIGNATURES.find((s) => s.label === label)!
const cfg = (bpm: number, label = '4/4', subdivision: MetronomeConfig['subdivision'] = 1) => ({
  bpm,
  signature: sig(label),
  subdivision,
})
const start: SchedulerState = { nextTime: 0, pulse: 0, sub: 0 }

describe('accentKind', () => {
  it('accents the downbeat and the dotted-quarter groups in compound time', () => {
    expect([0, 1, 2, 3].map((p) => accentKind(p, sig('4/4')))).toEqual([
      'bar',
      'beat',
      'beat',
      'beat',
    ])
    expect([0, 1, 2, 3, 4, 5].map((p) => accentKind(p, sig('6/8')))).toEqual([
      'bar',
      'beat',
      'beat',
      'group',
      'beat',
      'beat',
    ])
  })
})

describe('scheduleAhead', () => {
  it('schedules every click inside the look-ahead window', () => {
    const { clicks, state } = scheduleAhead(start, cfg(120), 0, 2)
    expect(clicks.map((c) => c.time)).toEqual([0, 0.5, 1, 1.5])
    expect(clicks.map((c) => c.kind)).toEqual(['bar', 'beat', 'beat', 'beat'])
    expect(state).toEqual({ nextTime: 2, pulse: 0, sub: 0 })
  })

  it('continues seamlessly across calls', () => {
    const first = scheduleAhead(start, cfg(120), 0, 2)
    const { clicks } = scheduleAhead(first.state, cfg(120), 2, 1)
    expect(clicks.map((c) => [c.time, c.kind])).toEqual([
      [2, 'bar'],
      [2.5, 'beat'],
    ])
  })

  it('adds quieter subdivision clicks between beats', () => {
    const eighths = scheduleAhead(start, cfg(60, '4/4', 2), 0, 1).clicks
    expect(eighths.map((c) => [c.time, c.kind])).toEqual([
      [0, 'bar'],
      [0.5, 'sub'],
    ])
    const triplets = scheduleAhead(start, cfg(60, '4/4', 3), 0, 0.9).clicks
    expect(triplets.map((c) => c.kind)).toEqual(['bar', 'sub', 'sub'])
    expect(triplets[1].time).toBeCloseTo(1 / 3, 9)
  })

  it('applies a BPM change from the next click on', () => {
    const fast = scheduleAhead(start, cfg(120), 0, 1)
    const slow = scheduleAhead(fast.state, cfg(60), 1, 2).clicks
    expect(slow.map((c) => c.time)).toEqual([1, 2])
  })

  it('skips missed clicks instead of bursting after the timer was throttled', () => {
    const behind: SchedulerState = { nextTime: 1, pulse: 1, sub: 0 }
    const { clicks } = scheduleAhead(behind, cfg(120), 5, 0.1)
    expect(clicks).toHaveLength(1)
    expect(clicks[0].time).toBeGreaterThanOrEqual(5)
  })

  it('wraps the pulse when the time signature shrinks mid-run', () => {
    const state: SchedulerState = { nextTime: 0, pulse: 3, sub: 0 }
    const { clicks } = scheduleAhead(state, cfg(120, '3/4'), 0, 0.1)
    expect(clicks[0]).toMatchObject({ pulse: 0, kind: 'bar' })
  })
})
