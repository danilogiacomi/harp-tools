import { freqToMidi } from '../music/pitch'
import { NoteMatcher, type MatcherConfig } from './noteMatcher'
import { weightedIndex, type Rng } from './random'
import { roundPoints, speedBonus } from './session'

export const MIN_PHRASE = 2
export const MAX_PHRASE = 5
/** Scored time budget per phrase note. */
export const MELODY_NOTE_LIMIT_MS = 3000
/** Largest jump between phrase notes, in places of the sorted pool. */
const MAX_STEP = 3

/** A phrase that walks the sorted pool in steps of 1–3 places, weighted 4 : 2 : 1. */
export function generatePhrase(midis: readonly number[], length: number, rng: Rng): number[] {
  if (midis.length === 0 || length <= 0) return []
  let idx = Math.min(midis.length - 1, Math.floor(rng() * midis.length))
  const phrase = [midis[idx]]
  while (phrase.length < length) {
    if (midis.length > 1) {
      const candidates: number[] = []
      const weights: number[] = []
      const lo = Math.max(0, idx - MAX_STEP)
      const hi = Math.min(midis.length - 1, idx + MAX_STEP)
      for (let j = lo; j <= hi; j++) {
        if (j === idx) continue
        candidates.push(j)
        weights.push(2 ** (MAX_STEP - Math.abs(j - idx)))
      }
      idx = candidates[weightedIndex(weights, rng)]
    }
    phrase.push(midis[idx])
  }
  return phrase
}

export function nextPhraseLength(length: number, success: boolean): number {
  return success ? Math.min(MAX_PHRASE, length + 1) : length
}

export type MelodyStatus = 'listening' | 'success' | 'wrong' | 'timeout'

export interface MelodyState {
  status: MelodyStatus
  /** Notes played correctly so far (= index of the note being waited for). */
  index: number
  progress: number
  wrongIndex: number | null
  wrongMidi: number | null
  elapsedMs: number
}

export interface MelodyConfig {
  matcher: MatcherConfig
  a4: number
}

/** The player echoes a phrase note by note; a steadily held other note is a mistake. */
export class MelodyRound {
  private index = 0
  private matcher: NoteMatcher
  private stray: NoteMatcher | null = null
  private current: MelodyState = {
    status: 'listening',
    index: 0,
    progress: 0,
    wrongIndex: null,
    wrongMidi: null,
    elapsedMs: 0,
  }

  constructor(
    private readonly phrase: readonly number[],
    private readonly config: MelodyConfig,
    private readonly startMs: number,
    private readonly limitMs: number | null,
  ) {
    if (phrase.length === 0) throw new Error('MelodyRound: empty phrase')
    this.matcher = new NoteMatcher(phrase[0], config.matcher, config.a4)
  }

  get state(): MelodyState {
    return this.current
  }

  push(freq: number | null, timeMs: number): MelodyState {
    if (this.current.status !== 'listening') return this.current
    const elapsedMs = timeMs - this.startMs
    const m = this.matcher.push(freq, timeMs)

    if (m.matched) {
      this.index += 1
      this.stray = null
      if (this.index === this.phrase.length) {
        this.current = {
          ...this.current,
          status: 'success',
          index: this.index,
          progress: 1,
          elapsedMs,
        }
        return this.current
      }
      this.matcher = new NoteMatcher(this.phrase[this.index], this.config.matcher, this.config.a4)
      this.current = { ...this.current, index: this.index, progress: 0, elapsedMs }
      return this.current
    }

    const wrongMidi = this.heldStray(freq, timeMs)
    if (wrongMidi !== null) {
      this.current = {
        ...this.current,
        status: 'wrong',
        progress: m.progress,
        wrongIndex: this.index,
        wrongMidi,
        elapsedMs,
      }
      return this.current
    }

    const timedOut = this.limitMs !== null && elapsedMs >= this.limitMs
    this.current = {
      ...this.current,
      status: timedOut ? 'timeout' : 'listening',
      progress: m.progress,
      elapsedMs,
    }
    return this.current
  }

  /** A pitch other than the expected or previous note, held as long as a real note: its MIDI. */
  private heldStray(freq: number | null, timeMs: number): number | null {
    const heard = freq === null ? null : freqToMidi(freq, this.config.a4)
    const candidate =
      heard !== null && Math.abs(heard.cents) <= this.config.matcher.toleranceCents
        ? heard.midi
        : null
    if (
      candidate === null ||
      candidate === this.phrase[this.index] ||
      candidate === this.phrase[this.index - 1]
    ) {
      this.stray = null
      return null
    }
    let stray = this.stray
    if (!stray || stray.target !== candidate) {
      stray = new NoteMatcher(candidate, this.config.matcher, this.config.a4)
      this.stray = stray
    }
    return stray.push(freq, timeMs).matched ? candidate : null
  }
}

export function melodyPoints(state: MelodyState, length: number): number {
  if (state.status === 'success') {
    return roundPoints(1, speedBonus(state.elapsedMs, MELODY_NOTE_LIMIT_MS * length))
  }
  return roundPoints(state.index / length, 1)
}
