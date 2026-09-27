import { act } from '@testing-library/react'
import { midiToFreq } from '../core/music/pitch'
import type { NotePlayer } from '../audio/NotePlayer'
import type { GameAudio, HeardListener } from '../ui/hooks/useGameAudio'

/**
 * Stand-in for useGameAudio in page tests:
 *   vi.mock('../../hooks/useGameAudio', () => import('../../../test/fakeGameAudio'))
 * Tests read `fakeAudio.played` and drive the game with hold().
 */
export const fakeAudio = {
  listener: null as HeardListener | null,
  time: 0,
  played: [] as number[][],
  error: null as GameAudio['error'],
  reset() {
    this.listener = null
    this.time = 0
    this.played = []
    this.error = null
  },
}

const player: NotePlayer = {
  play: async () => {},
  start: () => {},
  stop: () => {},
  isSounding: false,
  onSoundingChange: () => () => {},
}

const now = () => fakeAudio.time
const listen = (listener: HeardListener) => {
  fakeAudio.listener = listener
}
const playSequence = async (midis: readonly number[]) => {
  fakeAudio.played.push([...midis])
  return true
}
const cancelPlayback = () => {}

export function useGameAudio(): GameAudio {
  return {
    player,
    status: fakeAudio.error ? 'error' : 'listening',
    error: fakeAudio.error,
    detectedMidi: null,
    now,
    listen,
    playSequence,
    cancelPlayback,
  }
}

/** Plays `midi` (null = silence) into the game every 50 ms from `from` to `to` inclusive. */
export function hold(midi: number | null, from: number, to: number): void {
  act(() => {
    for (let t = from; t <= to; t += 50) {
      fakeAudio.time = t
      fakeAudio.listener?.(midi === null ? null : midiToFreq(midi), t)
    }
  })
}
