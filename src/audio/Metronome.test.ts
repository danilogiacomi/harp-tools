import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MetronomeConfig, TimeSignature } from '../core/rhythm/schedule'
import { audioEngine } from './AudioEngine'
import { Metronome } from './Metronome'

const TICK_MS = 25

class FakeAudioParam {
  value = 0
  setValueAtTime = vi.fn()
  exponentialRampToValueAtTime = vi.fn()
}

class FakeGainNode {
  gain = new FakeAudioParam()
  connect = vi.fn((dest: unknown) => dest)
}

class FakeOscillatorNode {
  frequency = new FakeAudioParam()
  connect = vi.fn((dest: unknown) => dest)
  start = vi.fn()
  stop = vi.fn()
}

/** Minimal stand-in for a real AudioContext, whose clock we advance by hand instead of relying
 *  on wall-clock time (jsdom doesn't provide a real AudioContext at all). */
class FakeAudioContext {
  currentTime = 0
  oscillators: FakeOscillatorNode[] = []
  createOscillator = vi.fn(() => {
    const osc = new FakeOscillatorNode()
    this.oscillators.push(osc)
    return osc as unknown as OscillatorNode
  })
  createGain = vi.fn(() => new FakeGainNode() as unknown as GainNode)
}

const SIGNATURE_4_4: TimeSignature = { label: '4/4', beats: 4, unit: 4 }
const SIGNATURE_6_8: TimeSignature = { label: '6/8', beats: 6, unit: 8 }

function makeConfig(overrides: Partial<MetronomeConfig> = {}): MetronomeConfig {
  return { bpm: 600, signature: SIGNATURE_4_4, subdivision: 1, ...overrides }
}

describe('Metronome', () => {
  let ctx: FakeAudioContext
  let master: FakeGainNode

  beforeEach(() => {
    vi.useFakeTimers()
    ctx = new FakeAudioContext()
    master = new FakeGainNode()
    vi.spyOn(audioEngine, 'now').mockImplementation(() => ctx.currentTime)
    vi.spyOn(audioEngine, 'ctx', 'get').mockReturnValue(ctx as unknown as AudioContext)
    vi.spyOn(audioEngine, 'master', 'get').mockReturnValue(master as unknown as GainNode)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  /** Advance the fake audio clock and the fake timers together by `ms`, one tick's worth of
   *  wall-clock time at a time, mirroring how the real 25ms interval and the real audio clock
   *  move in lockstep during normal (non-throttled) operation. */
  function run(totalMs: number) {
    for (let elapsed = 0; elapsed < totalMs; elapsed += TICK_MS) {
      ctx.currentTime += TICK_MS / 1000
      vi.advanceTimersByTime(TICK_MS)
    }
  }

  it('schedules the first click START_DELAY_S ahead, then keeps scheduling on later ticks', () => {
    const metronome = new Metronome(makeConfig(), vi.fn())

    metronome.start()
    expect(ctx.oscillators).toHaveLength(1)
    expect(ctx.oscillators[0].start).toHaveBeenCalledWith(0.05)

    run(500)
    expect(ctx.oscillators.length).toBeGreaterThan(1)
  })

  it('follows the accent pattern for click kind and frequency', () => {
    const metronome = new Metronome(makeConfig({ signature: SIGNATURE_6_8 }), vi.fn())

    metronome.start()
    run(300)

    const freqs = ctx.oscillators.map((o) => o.frequency.value)
    // 6/8 accents pulse 0 (bar) and pulse 3 (group, the second dotted-quarter); the rest are beats.
    expect(freqs.slice(0, 4)).toEqual([1600, 1000, 1000, 1250])
  })

  it('notifies onBeat for beat/bar clicks but never for sub clicks', () => {
    const onBeat = vi.fn()
    const metronome = new Metronome(makeConfig({ subdivision: 2 }), onBeat)

    metronome.start()
    run(300)

    expect(onBeat.mock.calls.length).toBeGreaterThan(0)
    expect(onBeat).not.toHaveBeenCalledWith(expect.anything(), 'sub')
    expect(onBeat.mock.calls[0]).toEqual([0, 'bar'])
  })

  it('applies a live setConfig change to the spacing of subsequent clicks', () => {
    const metronome = new Metronome(makeConfig({ bpm: 600 }), vi.fn())

    metronome.start() // first click scheduled using the 600 BPM (0.1s step) config
    metronome.setConfig(makeConfig({ bpm: 6000 })) // step shrinks to 0.01s before the next tick
    run(300)

    const times = ctx.oscillators.map((o) => o.start.mock.calls[0][0] as number)
    expect(times.length).toBeGreaterThan(2)
    const gaps = times.slice(1).map((t, i) => t - times[i])
    // The first gap still reflects the old (slower) spacing; later gaps reflect the new one.
    expect(gaps[gaps.length - 1]).toBeLessThan(gaps[0])
  })

  it('stop() clears the interval and cancels pending beat timeouts', () => {
    const onBeat = vi.fn()
    const metronome = new Metronome(makeConfig(), onBeat)

    metronome.start()
    metronome.stop()
    const countAtStop = ctx.oscillators.length

    run(1000)

    expect(ctx.oscillators).toHaveLength(countAtStop)
    expect(onBeat).not.toHaveBeenCalled()
    expect(metronome.isRunning).toBe(false)
  })

  it('does not double-schedule when start() is called twice', () => {
    const metronome = new Metronome(makeConfig(), vi.fn())

    metronome.start()
    const countAfterFirstStart = ctx.oscillators.length
    metronome.start()

    expect(ctx.oscillators).toHaveLength(countAfterFirstStart)
    expect(metronome.isRunning).toBe(true)
  })
})
