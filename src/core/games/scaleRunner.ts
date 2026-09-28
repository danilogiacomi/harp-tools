import { centsOff } from '../music/pitch'
import { NoteMatcher, type MatcherConfig } from './noteMatcher'
import { roundPoints, speedBonus } from './session'

export interface ScaleRunConfig {
  matcher: MatcherConfig
  a4: number
  /**
   * A note repeating the previous pitch only starts matching after a frame of silence or of
   * another pitch, so one long breath can't play `5 5 5` (the tab reader).
   */
  rearticulate?: boolean
}

export interface RunStep {
  index: number
  /** When the player started holding the note. */
  onsetMs: number
  /** From the previous note's completion (or the run start) to this one's. */
  timeMs: number
}

export interface ScaleRunState {
  /** Index of the note being waited for; sequence.length when done. */
  index: number
  done: boolean
  progress: number
  /** Set only on the push that completed a note. */
  completed: RunStep | null
}

/** Walks a sequence of pitches: the next note is the target; advance on each match. */
export class ScaleRun {
  private index = 0
  private matcher: NoteMatcher | null
  private noteStartMs: number
  /** Waiting for the break before a repeated note. */
  private awaitBreak = false
  private current: ScaleRunState

  constructor(
    private readonly sequence: readonly number[],
    private readonly config: ScaleRunConfig,
    startMs: number,
  ) {
    this.noteStartMs = startMs
    this.matcher = this.matcherAt(0)
    this.current = { index: 0, done: this.matcher === null, progress: 0, completed: null }
  }

  get state(): ScaleRunState {
    return this.current
  }

  push(freq: number | null, timeMs: number): ScaleRunState {
    if (!this.matcher) {
      if (this.current.completed) this.current = { ...this.current, completed: null }
      return this.current
    }
    if (this.awaitBreak) {
      const cents = freq === null ? null : centsOff(freq, this.matcher.target, this.config.a4)
      if (cents !== null && Math.abs(cents) <= this.config.matcher.toleranceCents) {
        this.current = { index: this.index, done: false, progress: 0, completed: null }
        return this.current
      }
      this.awaitBreak = false
    }
    const m = this.matcher.push(freq, timeMs)
    if (!m.matched) {
      this.current = { index: this.index, done: false, progress: m.progress, completed: null }
      return this.current
    }
    const completed: RunStep = {
      index: this.index,
      onsetMs: m.holdStartMs ?? timeMs,
      timeMs: timeMs - this.noteStartMs,
    }
    this.index += 1
    this.noteStartMs = timeMs
    this.matcher = this.matcherAt(this.index)
    this.awaitBreak =
      this.config.rearticulate === true &&
      this.sequence[this.index] === this.sequence[this.index - 1]
    this.current = { index: this.index, done: this.matcher === null, progress: 0, completed }
    return this.current
  }

  private matcherAt(index: number): NoteMatcher | null {
    return index < this.sequence.length
      ? new NoteMatcher(this.sequence[index], this.config.matcher, this.config.a4)
      : null
  }
}

/** Speed-bonus time budget per note without the metronome. */
export const RUN_NOTE_LIMIT_MS = 3000
/** Spec §8.4: notes landing within ±100 ms of the beat are rewarded. */
export const BEAT_WINDOW_MS = 100
/** Mic → reading delay (analysis window + median filter), subtracted from onsets. */
export const DETECTION_LATENCY_MS = 60

/** Distance from `onsetMs` to the nearest beat of a `bpm` grid passing through `beatMs`. */
export function beatOffsetMs(onsetMs: number, beatMs: number, bpm: number): number {
  const period = 60000 / bpm
  const d = (((onsetMs - beatMs) % period) + period) % period
  return Math.min(d, period - d)
}

export function runStepPoints(
  step: RunStep,
  beat: { bpm: number; lastBeatMs: number } | null,
): number {
  if (!beat) return roundPoints(1, speedBonus(step.timeMs, RUN_NOTE_LIMIT_MS))
  const offset = beatOffsetMs(step.onsetMs - DETECTION_LATENCY_MS, beat.lastBeatMs, beat.bpm)
  return roundPoints(1, offset <= BEAT_WINDOW_MS ? 2 : 1)
}
