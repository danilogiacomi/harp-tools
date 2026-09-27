import { describe, expect, it } from 'vitest'
import { midiToFreq } from '../music/pitch'
import { ScaleRun, beatOffsetMs, runStepPoints } from './scaleRunner'

const CONFIG = { matcher: { toleranceCents: 25, holdMs: 500 }, a4: 440 }
const hold = (run: ScaleRun, midi: number, from: number, to: number) => {
  let last = run.state
  for (let t = from; t <= to; t += 50) last = run.push(midiToFreq(midi), t)
  return last
}

describe('ScaleRun', () => {
  it('advances one note at a time and reports each completed step', () => {
    const run = new ScaleRun([60, 62, 64], CONFIG, 0)
    expect(run.state).toMatchObject({ index: 0, done: false })

    const first = hold(run, 60, 0, 500)
    expect(first).toMatchObject({
      index: 1,
      done: false,
      completed: { index: 0, onsetMs: 0, timeMs: 500 },
    })

    const second = hold(run, 62, 1000, 1500)
    expect(second).toMatchObject({ index: 2, completed: { index: 1, onsetMs: 1000, timeMs: 1000 } })

    const third = hold(run, 64, 1600, 2100)
    expect(third).toMatchObject({ index: 3, done: true, completed: { index: 2, onsetMs: 1600 } })
    expect(run.push(midiToFreq(64), 2200)).toMatchObject({ done: true, completed: null })
  })

  it('does not advance while the previous note is still sustained', () => {
    const run = new ScaleRun([60, 62, 64], CONFIG, 0)
    hold(run, 60, 0, 500)
    const sustained = hold(run, 60, 550, 2000)
    expect(sustained).toMatchObject({ index: 1, completed: null, progress: 0 })
  })

  it('reports hold progress on the current note', () => {
    const run = new ScaleRun([60], CONFIG, 0)
    run.push(midiToFreq(60), 0)
    expect(run.push(midiToFreq(60), 250).progress).toBeCloseTo(0.5)
  })

  it('is done at once for an empty sequence', () => {
    expect(new ScaleRun([], CONFIG, 0).state.done).toBe(true)
  })
})

describe('beatOffsetMs', () => {
  it('measures the distance to the nearest beat, before or after', () => {
    expect(beatOffsetMs(1480, 1000, 120)).toBeCloseTo(20)
    expect(beatOffsetMs(1250, 1000, 120)).toBeCloseTo(250)
    expect(beatOffsetMs(900, 1000, 120)).toBeCloseTo(100)
    expect(beatOffsetMs(2610, 1000, 120)).toBeCloseTo(110)
  })
})

describe('runStepPoints', () => {
  it('rewards speed without the metronome', () => {
    expect(runStepPoints({ index: 0, onsetMs: 0, timeMs: 1500 }, null)).toBe(150)
  })
  it('rewards landing on the beat (±100 ms, after latency compensation) with the metronome', () => {
    const beat = { bpm: 120, lastBeatMs: 1000 }
    // onset 1540 − 60 ms latency = 1480 → 20 ms from the beat at 1500
    expect(runStepPoints({ index: 0, onsetMs: 1540, timeMs: 9999 }, beat)).toBe(200)
    // onset 1310 − 60 = 1250 → 250 ms off
    expect(runStepPoints({ index: 0, onsetMs: 1310, timeMs: 0 }, beat)).toBe(100)
  })
})
