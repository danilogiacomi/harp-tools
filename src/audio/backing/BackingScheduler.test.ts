import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bluesForm } from '../../core/jam/blues'
import type { BackingConfig } from '../../core/jam/backingSchedule'
import { audioEngine } from '../AudioEngine'
import { BackingScheduler, DEFAULT_MIX } from './BackingScheduler'

const param = () => ({
  value: 0,
  setValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
})
const node = () => ({ connect: vi.fn((dest: unknown) => dest) })

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

  it('sets one mixer channel per instrument, live', () => {
    const s = new BackingScheduler(CONFIG, vi.fn())
    s.start()
    const channels = ctx.gains.slice(0, 5).map((g) => g.gain.value)
    expect(channels).toEqual([0.8, 0.6, 0.4, 0.8, 0.5])
    s.setMix({
      ...DEFAULT_MIX,
      bass: { volume: 0.3, muted: true },
      hat: { volume: 0.9, muted: false },
    })
    expect(ctx.gains.slice(0, 5).map((g) => g.gain.value)).toEqual([0.8, 0.6, 0.9, 0, 0.5])
  })

  it('tunes to the A4 setting', () => {
    const s = new BackingScheduler(CONFIG, vi.fn())
    s.setA4(442)
    s.start()
    const bass = ctx.started.find((n) => n.type === 'triangle')!
    expect(bass.freq).toBeCloseTo(98.44, 2) // G2 at A4 = 442
  })
})
