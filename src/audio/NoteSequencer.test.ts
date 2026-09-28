import { describe, expect, it, vi } from 'vitest'
import { FEEDBACK_TAIL_MS } from '../core/games/feedbackGate'
import type { NotePlayer } from './NotePlayer'
import { NoteSequencer } from './NoteSequencer'

function fakePlayer(onPlay: (midi: number) => void = () => {}) {
  const played: { midi: number; durationMs?: number }[] = []
  const player: NotePlayer = {
    play: vi.fn(async (midi: number, opts?: { durationMs?: number }) => {
      played.push({ midi, durationMs: opts?.durationMs })
      onPlay(midi)
    }),
    start: vi.fn(),
    stop: vi.fn(),
    isSounding: false,
    onSoundingChange: () => () => {},
  }
  return { player, played }
}

const instant = () => Promise.resolve()

describe('NoteSequencer', () => {
  it('plays the notes in order with the given length and gaps', async () => {
    const { player, played } = fakePlayer()
    const wait = vi.fn(instant)
    const seq = new NoteSequencer(player, wait)
    await expect(seq.play([60, 62, 64], 500, 100)).resolves.toBe(true)
    expect(played).toEqual([
      { midi: 60, durationMs: 500 },
      { midi: 62, durationMs: 500 },
      { midi: 64, durationMs: 500 },
    ])
    expect(wait).toHaveBeenCalledTimes(2)
    expect(wait).toHaveBeenCalledWith(100)
  })

  it('stops early and resolves false when cancelled', async () => {
    let seq: NoteSequencer | null = null
    const { player, played } = fakePlayer((midi) => {
      if (midi === 60) seq?.cancel()
    })
    seq = new NoteSequencer(player, instant)
    await expect(seq.play([60, 62])).resolves.toBe(false)
    expect(played.map((p) => p.midi)).toEqual([60])
    expect(player.stop).toHaveBeenCalled()
  })

  it('lets a newer sequence supersede an older one', async () => {
    const { player, played } = fakePlayer()
    const seq = new NoteSequencer(player, instant)
    const first = seq.play([60, 62, 64])
    const second = seq.play([70])
    await expect(first).resolves.toBe(false)
    await expect(second).resolves.toBe(true)
    expect(played.map((p) => p.midi)).toEqual([60, 70])
  })

  it('plays timed notes and rests with their own lengths', async () => {
    const { player, played } = fakePlayer()
    const waits: number[] = []
    const seq = new NoteSequencer(player, (ms) => {
      waits.push(ms)
      return instant()
    })
    await expect(
      seq.playTimed([
        { midi: 67, ms: 500 },
        { midi: null, ms: 250 },
        { midi: 70, ms: 1000 },
      ]),
    ).resolves.toBe(true)
    expect(played).toEqual([
      { midi: 67, durationMs: 450 },
      { midi: 70, durationMs: 900 },
    ])
    expect(waits).toEqual([50, 250, 100])
  })

  it('keeps the silence between long notes under the feedback gate’s tail', async () => {
    const { player, played } = fakePlayer()
    const waits: number[] = []
    const seq = new NoteSequencer(player, async (ms) => {
      waits.push(ms)
    })
    await seq.playTimed([
      { midi: 67, ms: 2000 },
      { midi: 67, ms: 600 },
    ])
    expect(played).toEqual([
      { midi: 67, durationMs: 1900 },
      { midi: 67, durationMs: 540 },
    ])
    expect(waits).toEqual([100, 60])
    expect(Math.max(...waits)).toBeLessThan(FEEDBACK_TAIL_MS)
  })

  it('abandons a timed prompt when cancelled or superseded', async () => {
    const { player, played } = fakePlayer()
    const seq = new NoteSequencer(player, instant)
    const first = seq.playTimed([
      { midi: 60, ms: 100 },
      { midi: 62, ms: 100 },
    ])
    const second = seq.play([70])
    await expect(first).resolves.toBe(false)
    await expect(second).resolves.toBe(true)
    expect(played.map((p) => p.midi)).toEqual([60, 70])
  })
})
