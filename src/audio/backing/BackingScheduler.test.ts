import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { KeepAwake } from '../screenAwake'
import { bluesForm } from '../../core/jam/blues'
import type { BackingConfig } from '../../core/jam/backingSchedule'
import { audioEngine } from '../AudioEngine'
import { BackingScheduler, DEFAULT_MIX } from './BackingScheduler'

const param = () => ({
  value: 0,
  setValueAtTime: vi.fn(),
  setTargetAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
})
const node = () => ({ connect: vi.fn((dest: unknown) => dest), disconnect: vi.fn() })
/** Where each channel is gliding to: the last setTargetAtTime value (value itself stays 0). */
const targets = (gains: { gain: ReturnType<typeof param> }[]) =>
  gains.map((g) => g.gain.setTargetAtTime.mock.calls.at(-1)?.[0])

/** Records every source node the voices start, with its type and frequency. */
class FakeAudioContext {
  currentTime = 0
  sampleRate = 8000
  started: { type: string; freq: number; at: number }[] = []
  gains: { gain: ReturnType<typeof param> }[] = []
  createGain = () => {
    const g = { ...node(), gain: param() }
    this.gains.push(g)
    return g
  }
  createBiquadFilter = () => ({ ...node(), type: '', frequency: param() })
  createBuffer = (_channels: number, length: number) => {
    const data = new Float32Array(length)
    return { getChannelData: () => data }
  }
  createOscillator = () => {
    const osc = {
      ...node(),
      type: 'sine',
      frequency: param(),
      detune: param(),
      start: (at: number) => this.started.push({ type: osc.type, freq: osc.frequency.value, at }),
      stop: vi.fn(),
    }
    return osc
  }
  createBufferSource = () => {
    const src = {
      ...node(),
      buffer: null,
      start: (at: number) => this.started.push({ type: 'noise', freq: 0, at }),
      stop: vi.fn(),
    }
    return src
  }
}

/** Counts how many holds are currently active. */
function fakeAwake() {
  let active = 0
  const awake: KeepAwake = {
    hold: () => {
      active++
      let done = false
      return () => {
        if (!done) active--
        done = true
      }
    },
  }
  return { awake, active: () => active }
}

// 120 BPM: a beat every 0.5 s. G blues (C harp, 2nd position).
const CONFIG: BackingConfig = { bpm: 120, feel: 'shuffle', form: bluesForm(false), tonicPc: 7 }

describe('BackingScheduler', () => {
  let ctx: FakeAudioContext
  let master: ReturnType<typeof node>

  beforeEach(() => {
    vi.useFakeTimers()
    ctx = new FakeAudioContext()
    master = node()
    vi.spyOn(audioEngine, 'now').mockImplementation(() => ctx.currentTime)
    vi.spyOn(audioEngine, 'ctx', 'get').mockReturnValue(ctx as unknown as AudioContext)
    vi.spyOn(audioEngine, 'master', 'get').mockReturnValue(master as unknown as GainNode)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  /** Moves the audio clock and the timers on together, 25 ms at a time. */
  const run = (ms: number) => {
    for (let t = 0; t < ms; t += 25) {
      ctx.currentTime += 0.025
      vi.advanceTimersByTime(25)
    }
  }

  it('schedules the first beat just after start: kick, hats, bass and a chord stab', () => {
    const s = new BackingScheduler(CONFIG, vi.fn())
    s.start()
    const at = (t: number) => ctx.started.filter((n) => Math.abs(n.at - t) < 1e-9)
    // Beat 1 at 0.05 s: kick (sine), a hat (noise), the bass root (triangle + square at G2).
    expect(at(0.05).map((n) => n.type)).toEqual(['sine', 'noise', 'triangle', 'square'])
    expect(at(0.05)[2].freq).toBeCloseTo(98, 1) // G2
    // The swung offbeat at 0.05 + 1/3 s: a hat, the bass 3rd and 12 saws (4 notes × 3).
    const off = at(0.05 + 1 / 3)
    expect(off.filter((n) => n.type === 'sawtooth')).toHaveLength(12)
    expect(off.filter((n) => n.type === 'noise')).toHaveLength(1)
  })

  it('keeps scheduling on its timer and reports each bar when it is heard', () => {
    const onBar = vi.fn()
    const s = new BackingScheduler(CONFIG, onBar)
    s.start()
    run(100)
    expect(onBar).toHaveBeenCalledWith(0)
    run(2000) // one bar is 2 s at 120 BPM
    expect(onBar).toHaveBeenLastCalledWith(1)
    expect(ctx.started.filter((n) => n.type === 'sine').length).toBe(3) // kicks on beats 1 and 3
  })

  it('counts in with the hi-hat alone, and reports the count-in bar as -1', () => {
    const onBar = vi.fn()
    const s = new BackingScheduler({ ...CONFIG, countInBars: 1 }, onBar)
    s.start()
    const at = (t: number) => ctx.started.filter((n) => Math.abs(n.at - t) < 1e-9)
    expect(at(0.05).map((n) => n.type)).toEqual(['noise'])
    run(100)
    expect(onBar).toHaveBeenCalledWith(-1)
    run(2000)
    expect(onBar).toHaveBeenLastCalledWith(0)
  })

  it('stops scheduling and cancels a pending bar report', () => {
    const onBar = vi.fn()
    const s = new BackingScheduler(CONFIG, onBar)
    s.start()
    s.stop()
    const count = ctx.started.length
    run(3000)
    expect(ctx.started.length).toBe(count)
    expect(onBar).not.toHaveBeenCalled()
    expect(s.isRunning).toBe(false)
  })

  it('sets one mixer channel per instrument, live, gliding so a change never clicks', () => {
    const s = new BackingScheduler(CONFIG, vi.fn())
    s.start()
    const channels = ctx.gains.slice(0, 5)
    expect(targets(channels)).toEqual([0.8, 0.6, 0.4, 0.8, 0.5])
    ctx.currentTime = 1.5
    s.setMix({
      ...DEFAULT_MIX,
      bass: { volume: 0.3, muted: true },
      hat: { volume: 0.9, muted: false },
    })
    expect(targets(channels)).toEqual([0.8, 0.6, 0.9, 0, 0.5])
    expect(channels[2].gain.setTargetAtTime).toHaveBeenLastCalledWith(0.9, 1.5, 0.01)
    expect(channels.map((g) => g.gain.value)).toEqual([0, 0, 0, 0, 0])
  })

  it('fades its channels out on stop, so notes already scheduled go quiet, and back on start', () => {
    const s = new BackingScheduler(CONFIG, vi.fn())
    s.start()
    const channels = ctx.gains.slice(0, 5)
    ctx.currentTime = 2
    s.stop()
    expect(targets(channels)).toEqual([0, 0, 0, 0, 0])
    expect(channels[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 2, 0.01)
    s.setMix({ ...DEFAULT_MIX, kick: { volume: 0.2, muted: false } })
    expect(targets(channels)).toEqual([0, 0, 0, 0, 0]) // stays quiet while stopped
    s.start()
    expect(targets(channels)).toEqual([0.2, 0.6, 0.4, 0.8, 0.5])
  })

  it('disconnects its channels when disposed, and builds new ones if started again', () => {
    const s = new BackingScheduler(CONFIG, vi.fn())
    s.start()
    const channels = ctx.gains.slice(0, 5) as unknown as ReturnType<typeof node>[]
    s.dispose()
    expect(s.isRunning).toBe(false)
    for (const ch of channels) expect(ch.disconnect).toHaveBeenCalled()
    s.start()
    expect(ctx.gains.length).toBeGreaterThan(5)
  })

  it('tunes to the A4 setting', () => {
    const s = new BackingScheduler(CONFIG, vi.fn())
    s.setA4(442)
    s.start()
    const bass = ctx.started.find((n) => n.type === 'triangle')!
    expect(bass.freq).toBeCloseTo(98.44, 2) // G2 at A4 = 442
  })

  it('holds the screen while playing, and releases it on stop and on dispose', () => {
    const { awake, active } = fakeAwake()
    const s = new BackingScheduler(CONFIG, vi.fn(), DEFAULT_MIX, awake)

    s.start()
    expect(active()).toBe(1)
    s.stop()
    expect(active()).toBe(0)
    s.start()
    s.dispose()
    expect(active()).toBe(0)
  })

  it('holds nothing when start() throws, so a retry cannot leak a hold', () => {
    const { awake, active } = fakeAwake()
    const s = new BackingScheduler(CONFIG, vi.fn(), DEFAULT_MIX, awake)
    vi.spyOn(audioEngine, 'ctx', 'get').mockImplementationOnce(() => {
      throw new Error('engine not ready')
    })

    expect(() => s.start()).toThrow()
    expect(active()).toBe(0)
    s.start()
    s.stop()
    expect(active()).toBe(0)
  })
})
