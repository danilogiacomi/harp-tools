import { afterEach, describe, expect, it, vi } from 'vitest'
import { audioEngine } from './AudioEngine'
import { SynthNotePlayer } from './SynthNotePlayer'

interface FakeOscillator {
  type: string
  frequency: { value: number }
  connect: (dest: unknown) => unknown
  start: (t: number) => void
  stop: (t: number) => void
  onended: (() => void) | null
}

/** Minimal stand-in for the AudioContext methods SynthNotePlayer uses; records every
 * oscillator it creates so a test can inspect the frequency it was given. */
function fakeCtx(): { ctx: AudioContext; oscillators: FakeOscillator[] } {
  const oscillators: FakeOscillator[] = []
  const fakeGain = () => ({
    gain: {
      value: 0,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
    },
    connect: vi.fn((dest: unknown) => dest),
    disconnect: vi.fn(),
  })
  const ctx = {
    currentTime: 0,
    createGain: vi.fn(fakeGain),
    createBiquadFilter: vi.fn(() => ({
      type: '',
      frequency: { value: 0 },
      Q: { value: 0 },
      connect: vi.fn((dest: unknown) => dest),
    })),
    createOscillator: vi.fn(() => {
      const osc: FakeOscillator = {
        type: '',
        frequency: { value: 0 },
        connect: vi.fn((dest: unknown) => dest),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      }
      oscillators.push(osc)
      return osc
    }),
  }
  return { ctx: ctx as unknown as AudioContext, oscillators }
}

describe('SynthNotePlayer', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses the latest A4 after setA4Getter(), on the same instance', () => {
    const { ctx, oscillators } = fakeCtx()
    vi.spyOn(audioEngine, 'ctx', 'get').mockReturnValue(ctx)
    vi.spyOn(audioEngine, 'master', 'get').mockReturnValue({
      connect: vi.fn(),
    } as unknown as GainNode)

    const player = new SynthNotePlayer(() => 440)
    player.start(69) // A4
    expect(oscillators.slice(-2).map((o) => o.frequency.value)).toEqual([440, 440])

    player.setA4Getter(() => 442)
    player.start(69)
    expect(oscillators.slice(-2).map((o) => o.frequency.value)).toEqual([442, 442])

    // The getter swap didn't replace the player: still the one instance, still sounding.
    expect(player.isSounding).toBe(true)
  })

  it('reports when it starts and stops sounding, not when one note replaces another', () => {
    const { ctx } = fakeCtx()
    vi.spyOn(audioEngine, 'ctx', 'get').mockReturnValue(ctx)
    vi.spyOn(audioEngine, 'master', 'get').mockReturnValue({
      connect: vi.fn(),
    } as unknown as GainNode)

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
