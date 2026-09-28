import { DETECTION_LATENCY_MS } from '../games/scaleRunner'
import { freqToMidi } from '../music/pitch'
import { BeatAnchor } from './beatAnchor'

export type PatternId = 'quarters' | 'eighths' | 'shuffle' | 'offbeats' | 'charleston' | 'train'

export interface RhythmPattern {
  id: PatternId
  name: string
  /** One bar of 4/4, as onsets in beats from the downbeat. */
  onsets: readonly number[]
  /** Onsets drawn accented. */
  accents: readonly number[]
}

export const BEATS_PER_BAR = 4
const SWING = 2 / 3

export const RHYTHM_PATTERNS: readonly RhythmPattern[] = [
  { id: 'quarters', name: 'Quarters', onsets: [0, 1, 2, 3], accents: [] },
  { id: 'eighths', name: 'Eighths', onsets: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], accents: [] },
  {
    id: 'shuffle',
    name: 'Shuffle',
    onsets: [0, SWING, 1, 1 + SWING, 2, 2 + SWING, 3, 3 + SWING],
    accents: [],
  },
  { id: 'offbeats', name: 'Offbeats', onsets: [0.5, 1.5, 2.5, 3.5], accents: [] },
  { id: 'charleston', name: 'Charleston', onsets: [0, 1.5], accents: [] },
  { id: 'train', name: 'Train', onsets: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], accents: [0, 2] },
]

export function patternById(id: PatternId): RhythmPattern {
  const p = RHYTHM_PATTERNS.find((x) => x.id === id)
  if (!p) throw new Error(`Unknown pattern: ${id}`)
  return p
}

export type Grade = 'perfect' | 'good' | 'off' | 'miss'

/** Spec §9 grading windows (|offset|, ms) and points per hit. */
export const PERFECT_MS = 40
export const GOOD_MS = 100
export const MATCH_WINDOW_MS = 250
export const GRADE_POINTS: Record<Grade, number> = { perfect: 100, good: 70, off: 30, miss: 0 }
/** A pitched reading after at least this long without one starts a note. */
export const ONSET_GAP_MS = 80
/** A change of note only counts as a new onset this long after the previous one (ignores a
 *  reading that flickers between two neighbouring notes). */
export const NOTE_CHANGE_DEBOUNCE_MS = 100

export function gradeOffset(offsetMs: number): Exclude<Grade, 'miss'> {
  const a = Math.abs(offsetMs)
  if (a <= PERFECT_MS) return 'perfect'
  if (a <= GOOD_MS) return 'good'
  return 'off'
}

/** Finds note onsets in the mic stream; pitch doesn't matter, only when a note starts. */
export class OnsetDetector {
  private lastPitchedMs: number | null = null
  private lastMidi: number | null = null
  private lastOnsetMs = -Infinity

  constructor(private readonly a4 = 440) {}

  /** The onset time, corrected for detection latency, when this reading starts a note. */
  push(freq: number | null, timeMs: number): number | null {
    if (freq === null) return null
    const midi = freqToMidi(freq, this.a4).midi
    const afterGap = this.lastPitchedMs === null || timeMs - this.lastPitchedMs >= ONSET_GAP_MS
    const newNote = midi !== this.lastMidi && timeMs - this.lastOnsetMs >= NOTE_CHANGE_DEBOUNCE_MS
    this.lastPitchedMs = timeMs
    this.lastMidi = midi
    if (!afterGap && !newNote) return null
    this.lastOnsetMs = timeMs
    return timeMs - DETECTION_LATENCY_MS
  }
}

export interface RhythmHit {
  /** 0 = the first expected hit after the count-in. */
  index: number
  bar: number
  /** Onset within the bar, in beats. */
  beat: number
  expectedMs: number
  /** Positive = late. Null for a miss. */
  offsetMs: number | null
  grade: Grade
}

export interface RhythmConfig {
  pattern: RhythmPattern
  bpm: number
  countInBars: number
  /** Bars to play after the count-in; null = keep going (practice). */
  bars: number | null
  a4: number
}

/**
 * Matches the player's onsets to the pattern's expected hits on the metronome grid. Feed it every
 * heard beat (`syncBeat`) and every mic frame (`push`); each push returns the hits it resolved.
 */
export class RhythmSession {
  private readonly anchor: BeatAnchor
  private readonly detector: OnsetDetector
  private pending: { index: number; expectedMs: number }[] = []
  private nextIndex = 0
  private resolvedCount = 0

  constructor(private readonly config: RhythmConfig) {
    this.anchor = new BeatAnchor(60000 / config.bpm)
    this.detector = new OnsetDetector(config.a4)
  }

  get totalHits(): number | null {
    const { bars, pattern } = this.config
    return bars === null ? null : bars * pattern.onsets.length
  }

  get done(): boolean {
    const total = this.totalHits
    return total !== null && this.resolvedCount >= total
  }

  syncBeat(beatMs: number): void {
    this.anchor.sync(beatMs)
  }

  /** When hit `index` is due, or null before the metronome's first beat. */
  expectedMs(index: number): number | null {
    const { onsets } = this.config.pattern
    const bar = this.config.countInBars + Math.floor(index / onsets.length)
    return this.anchor.beatTime(bar * BEATS_PER_BAR + onsets[index % onsets.length])
  }

  push(freq: number | null, timeMs: number): RhythmHit[] {
    const onset = this.detector.push(freq, timeMs)
    if (this.anchor.originMs === null || this.done) return []
    const heardUpTo = timeMs - DETECTION_LATENCY_MS
    const total = this.totalHits

    // Every hit an onset heard so far could still match.
    for (;;) {
      if (total !== null && this.nextIndex >= total) break
      const expectedMs = this.expectedMs(this.nextIndex)!
      if (expectedMs > heardUpTo + MATCH_WINDOW_MS) break
      this.pending.push({ index: this.nextIndex, expectedMs })
      this.nextIndex++
    }

    const resolved: RhythmHit[] = []
    if (onset !== null) {
      let best: { index: number; expectedMs: number } | null = null
      for (const p of this.pending) {
        const d = Math.abs(onset - p.expectedMs)
        if (d <= MATCH_WINDOW_MS && (!best || d < Math.abs(onset - best.expectedMs))) best = p
      }
      if (best) {
        const offsetMs = onset - best.expectedMs
        resolved.push(this.hit(best, offsetMs, gradeOffset(offsetMs)))
        this.pending = this.pending.filter((p) => p !== best)
      }
    }
    // Too late for any onset still to come: a miss.
    const missed = this.pending.filter((p) => p.expectedMs + MATCH_WINDOW_MS < heardUpTo)
    for (const p of missed) resolved.push(this.hit(p, null, 'miss'))
    this.pending = this.pending.filter((p) => !missed.includes(p))

    this.resolvedCount += resolved.length
    return resolved.sort((a, b) => a.index - b.index)
  }

  private hit(
    p: { index: number; expectedMs: number },
    offsetMs: number | null,
    grade: Grade,
  ): RhythmHit {
    const { onsets } = this.config.pattern
    return {
      index: p.index,
      bar: Math.floor(p.index / onsets.length),
      beat: onsets[p.index % onsets.length],
      expectedMs: p.expectedMs,
      offsetMs,
      grade,
    }
  }
}

/** Mean signed offset of the hits that landed (misses don't count); null if none did. */
export function averageOffset(hits: readonly RhythmHit[]): number | null {
  const landed = hits.filter((h): h is RhythmHit & { offsetMs: number } => h.offsetMs !== null)
  if (landed.length === 0) return null
  return landed.reduce((sum, h) => sum + h.offsetMs, 0) / landed.length
}

/** Best scores are kept per pattern and tempo, the tempo rounded to the nearest 10 BPM. */
export function bpmBucket(bpm: number): number {
  return Math.round(bpm / 10) * 10
}
