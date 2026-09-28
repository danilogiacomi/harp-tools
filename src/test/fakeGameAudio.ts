import { act } from '@testing-library/react'
import { useEffect } from 'react'
import { midiToFreq } from '../core/music/pitch'
import type { NotePlayer } from '../audio/NotePlayer'
import type { TimedPrompt } from '../audio/NoteSequencer'
import type { GameAudio, HeardListener } from '../ui/hooks/useGameAudio'
import type { PitchStatus } from '../ui/hooks/usePitch'

/**
 * Stand-in for useGameAudio in page tests:
 *   vi.mock('../../hooks/useGameAudio', () => import('../../../test/fakeGameAudio'))
 * Tests read `fakeAudio.played` (the pitches of every prompt, timed or not; `timed` keeps the
 * timed prompts whole) and drive the game with hold(). With `deferPlayback`, prompts stay
 * pending until finishPlayback(); a new prompt or cancelPlayback() abandons them (false).
 */
export const fakeAudio = {
  listener: null as HeardListener | null,
  time: 0,
  played: [] as number[][],
  timed: [] as TimedPrompt[][],
  error: null as GameAudio['error'],
  /** Mic status while listening and error-free, e.g. 'starting' before the first frame. */
  micStatus: 'listening' as PitchStatus,
  /** How many times the mic was switched on. */
  micStarts: 0,
  cancels: 0,
  deferPlayback: false,
  pending: [] as ((done: boolean) => void)[],
  reset() {
    this.listener = null
    this.time = 0
    this.played = []
    this.timed = []
    this.error = null
    this.micStatus = 'listening'
    this.micStarts = 0
    this.cancels = 0
    this.deferPlayback = false
    this.pending = []
  },
}

const abandonPending = () => {
  const pending = fakeAudio.pending
  fakeAudio.pending = []
  pending.forEach((resolve) => resolve(false))
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
  return () => {
    if (fakeAudio.listener === listener) fakeAudio.listener = null
  }
}
const prompt = (midis: readonly number[]) => {
  fakeAudio.played.push([...midis])
  if (!fakeAudio.deferPlayback) return Promise.resolve(true)
  abandonPending()
  return new Promise<boolean>((resolve) => fakeAudio.pending.push(resolve))
}
const playSequence = (midis: readonly number[]) => prompt(midis)
const playTimed = (notes: readonly TimedPrompt[]) => {
  fakeAudio.timed.push([...notes])
  return prompt(notes.flatMap((n) => (n.midi === null ? [] : [n.midi])))
}
const cancelPlayback = () => {
  fakeAudio.cancels++
  abandonPending()
}

export function useGameAudio(listening: boolean): GameAudio {
  useEffect(() => {
    if (listening) fakeAudio.micStarts++
  }, [listening])
  const error = listening ? fakeAudio.error : null
  return {
    player,
    status: !listening ? 'idle' : error ? 'error' : fakeAudio.micStatus,
    error,
    detectedMidi: null,
    now,
    listen,
    playSequence,
    playTimed,
    cancelPlayback,
  }
}

/** Lets the pending (deferred) prompt finish playing. */
export async function finishPlayback(): Promise<void> {
  await act(async () => {
    fakeAudio.pending.shift()?.(true)
  })
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
