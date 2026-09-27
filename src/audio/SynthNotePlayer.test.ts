import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { audioEngine } from './AudioEngine'
import { SynthNotePlayer } from './SynthNotePlayer'

interface FakeParam {
  value: number
  setValueAtTime: ReturnType<typeof vi.fn>
  linearRampToValueAtTime: ReturnType<typeof vi.fn>
  cancelScheduledValues: ReturnType<typeof vi.fn>
}
interface FakeOscillator {
  type: string
  frequency: { value: number }
  connect: (dest: unknown) => unknown
  start: (t: number) => void
  stop: (t: number) => void
  onended: (() => void) | null
}
interface FakeFilter {
  type: string
  frequency: { value: number }
  Q: { value: number }
}

/** Stand-in for the AudioContext methods SynthNotePlayer uses; records what it creates. */
function fakeCtx() {
  const oscillators: FakeOscillator[] = []
  const filters: FakeFilter[] = []
  const gains: { gain: FakeParam }[] = []
  const sources: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = []
  const param = (): FakeParam => ({
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  })
  const ctx = {
    currentTime: 0,
    sampleRate: 48000,
    createGain: vi.fn(() => {
      const g = { gain: param(), connect: vi.fn((d: unknown) => d), disconnect: vi.fn() }
      gains.push(g)
      return g
    }),
    createBiquadFilter: vi.fn(() => {
      const f = {
        type: '',
        frequency: { value: 0 },
        Q: { value: 0 },
        connect: vi.fn((d: unknown) => d),
      }
      filters.push(f)
      return f
    }),
    createOscillator: vi.fn(() => {
      const osc: FakeOscillator = {
        type: '',
        frequency: { value: 0 },
        connect: vi.fn((d: unknown) => d),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      }
      oscillators.push(osc)
      return osc
    }),
    createBuffer: vi.fn((_channels: number, length: number) => {
      const data = new Float32Array(length)
      return { getChannelData: () => data }
    }),
    createBufferSource: vi.fn(() => {
      const s = { buffer: null, connect: vi.fn((d: unknown) => d), start: vi.fn(), stop: vi.fn() }
      sources.push(s)
      return s
    }),
  }
  return { ctx: ctx as unknown as AudioContext, oscillators, filters, gains, sources }
}

let fake: ReturnType<typeof fakeCtx>

describe('SynthNotePlayer', () => {
  beforeEach(() => {
    fake = fakeCtx()
    vi.spyOn(audioEngine, 'ctx', 'get').mockReturnValue(fake.ctx)
    vi.spyOn(audioEngine, 'master', 'get').mockReturnValue({
      connect: vi.fn(),
    } as unknown as GainNode)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Reed (default): sine partials at exact multiples, low-pass at 5 × f0, 35 ms attack', () => {
    const player = new SynthNotePlayer(() => 440)
    player.start(69) // A4
    expect(fake.oscillators.map((o) => [o.type, o.frequency.value])).toEqual([
      ['sine', 440],
      ['sine', 880],
      ['sine', 1320],
      ['sine', 1760],
      ['sine', 2200],
    ])
    expect(fake.filters.map((f) => [f.type, f.frequency.value])).toEqual([
      ['lowpass', 2200],
      ['bandpass', 2000],
    ])
    // gains[0] is the note envelope.
    expect(fake.gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.25, 0.035)
  })

  it('Reed: a short breath-noise burst at the onset that stops on its own', () => {
    const player = new SynthNotePlayer(() => 440)
    player.start(60)
    expect(fake.sources).toHaveLength(1)
    expect(fake.sources[0].start).toHaveBeenCalledWith(0)
    expect(fake.sources[0].stop).toHaveBeenCalledWith(0.07)
    player.stop()
    // Releasing the note stops the oscillators, never the (already scheduled) breath again.
    expect(fake.sources[0].stop).toHaveBeenCalledTimes(1)
    // The noise buffer is made once per context and reused.
    player.start(62)
    expect(fake.ctx.createBuffer).toHaveBeenCalledTimes(1)
  })

  it('Pure: the old sawtooth + triangle voice with a 20 ms attack', () => {
    const player = new SynthNotePlayer(() => 440, 'pure')
    player.start(69)
    expect(fake.oscillators.map((o) => [o.type, o.frequency.value])).toEqual([
      ['sawtooth', 440],
      ['triangle', 440],
    ])
    expect(fake.sources).toHaveLength(0)
    expect(fake.gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.25, 0.02)
  })

  it('switches voice with setSound() for the next note', () => {
    const player = new SynthNotePlayer(() => 440)
    player.setSound('pure')
    player.start(69)
    expect(fake.oscillators.map((o) => o.type)).toEqual(['sawtooth', 'triangle'])
  })

  it('uses the latest A4 after setA4Getter(), on the same instance', () => {
    const player = new SynthNotePlayer(() => 440)
    player.start(69)
    expect(fake.oscillators[0].frequency.value).toBe(440)
    player.setA4Getter(() => 442)
    player.start(69)
    expect(fake.oscillators[5].frequency.value).toBe(442)
    expect(player.isSounding).toBe(true)
  })

  it('reports when it starts and stops sounding, not when one note replaces another', () => {
    const player = new SynthNotePlayer(() => 440)
    const events: boolean[] = []
    const off = player.onSoundingChange((s) => events.push(s))
    player.start(60)
    player.start(62)
    player.stop()
    player.stop()
    expect(events).toEqual([true, false])
    off()
    player.start(60)
    expect(events).toEqual([true, false])
  })
})
