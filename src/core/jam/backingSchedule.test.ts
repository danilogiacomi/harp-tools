import { describe, expect, it } from 'vitest'
import { bluesForm } from './blues'
import {
  bassMidi,
  chordMidis,
  offbeatFraction,
  scheduleBacking,
  type BackingConfig,
  type BackingEvent,
} from './backingSchedule'

// 120 BPM: a beat every 0.5 s; the shuffle offbeat 1/3 s after it.
const G_SHUFFLE: BackingConfig = { bpm: 120, feel: 'shuffle', form: bluesForm(false), tonicPc: 7 }
const start = { nextBeatTime: 1, bar: 0, beat: 0 }
const ms = (s: number) => Math.round(s * 1000) / 1000
/** Times and durations to the millisecond, for readable expectations. */
const round = (events: BackingEvent[]) =>
  events.map((e) =>
    'duration' in e
      ? { ...e, time: ms(e.time), duration: ms(e.duration) }
      : { ...e, time: ms(e.time) },
  )

describe('swing', () => {
  it('puts the offbeat 2/3 through the beat on the shuffle, halfway when straight', () => {
    expect(offbeatFraction('shuffle')).toBeCloseTo(0.667, 3)
    expect(offbeatFraction('straight')).toBe(0.5)
  })
})

describe('voicing', () => {
  it('puts the bass in the second octave and the chords around middle C', () => {
    expect(bassMidi(7, 0)).toBe(43) // G2
    expect(chordMidis(7)).toEqual([55, 59, 62, 65]) // G3 B3 D4 F4
    expect(chordMidis(4)).toEqual([52, 56, 59, 62]) // E3 …
    expect(chordMidis(3)).toEqual([63, 67, 70, 73]) // Eb4 …
  })
})

describe('scheduleBacking', () => {
  it('schedules one shuffle beat: bar, kick, swung hats and bass, an offbeat stab', () => {
    const { events, state } = scheduleBacking(start, G_SHUFFLE, 1, 0.1)
    expect(round(events)).toEqual([
      { kind: 'bar', time: 1, bar: 0 },
      { kind: 'kick', time: 1 },
      { kind: 'hat', time: 1 },
      { kind: 'hat', time: 1.333 },
      { kind: 'bass', time: 1, midi: 43, duration: 0.3 },
      { kind: 'bass', time: 1.333, midi: 47, duration: 0.15 },
      { kind: 'chords', time: 1.333, midis: [55, 59, 62, 65], duration: 0.12 },
    ])
    expect(state).toEqual({ nextBeatTime: 1.5, bar: 0, beat: 1 })
  })

  it('plays the snare on beats 2 and 4 and walks the bass through the bar', () => {
    const { events } = scheduleBacking(start, G_SHUFFLE, 1, 2)
    expect(events.filter((e) => e.kind === 'snare').map((e) => e.time)).toEqual([1.5, 2.5])
    expect(events.filter((e) => e.kind === 'kick').map((e) => e.time)).toEqual([1, 2])
    expect(events.flatMap((e) => (e.kind === 'bass' ? [e.midi - 43] : []))).toEqual([
      0, 4, 7, 9, 10, 9, 7, 4,
    ])
  })

  it('plays quarters in the bass and straight eighths on the hat when straight', () => {
    const { events } = scheduleBacking(start, { ...G_SHUFFLE, feel: 'straight' }, 1, 2)
    expect(events.flatMap((e) => (e.kind === 'bass' ? [e.midi - 43] : []))).toEqual([0, 4, 7, 9])
    expect(events.filter((e) => e.kind === 'hat').map((e) => e.time)).toEqual([
      1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75,
    ])
  })

  it('follows the form: a new chord every bar, round and round', () => {
    const { events } = scheduleBacking(start, { ...G_SHUFFLE, form: bluesForm(true) }, 1, 26)
    const bars = events.filter((e) => e.kind === 'bar')
    expect(bars.map((e) => (e.kind === 'bar' ? e.bar : -1))).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0,
    ])
    // Quick change: bar 2 is on C7, so its first bass note is C2.
    const bass = events.filter((e) => e.kind === 'bass' && e.time === 3)
    expect(bass).toEqual([{ kind: 'bass', time: 3, midi: 36, duration: 0.3 }])
  })

  it('skips beats a throttled timer missed instead of playing them all at once', () => {
    const { events, state } = scheduleBacking(start, G_SHUFFLE, 10, 0.1)
    expect(events[0]).toEqual({ kind: 'bar', time: 10, bar: 0 })
    expect(state.nextBeatTime).toBe(10.5)
  })

  it('applies a new tempo from the next beat', () => {
    const first = scheduleBacking(start, G_SHUFFLE, 1, 0.1)
    const next = scheduleBacking(first.state, { ...G_SHUFFLE, bpm: 60 }, 1.45, 0.1)
    expect(next.state.nextBeatTime).toBe(2.5)
  })
})
