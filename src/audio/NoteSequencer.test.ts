import { describe, expect, it, vi } from 'vitest'
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
})
