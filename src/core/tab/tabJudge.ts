import { DETECTION_LATENCY_MS } from '../games/scaleRunner'
import { freqToMidi } from '../music/pitch'

/** Spec §10: "Wait for me" accepts a note held this long; scored notes need at most this. */
export const TAB_HOLD_MS = 250
/** A scored note must start within this of its onset. */
export const ONSET_WINDOW_MS = 150
/** Onsets this close earn full timing credit. */
export const FULL_TIMING_MS = 50

/** A scored note must be held min(250 ms, 60 % of its length). */
export function requiredHoldMs(durationMs: number): number {
  return Math.min(TAB_HOLD_MS, 0.6 * durationMs)
}

/** 1 within ±50 ms, falling linearly to 0.5 at ±150 ms; 0 beyond. */
export function timingFactor(offsetMs: number): number {
  const a = Math.abs(offsetMs)
  if (a > ONSET_WINDOW_MS) return 0
  if (a <= FULL_TIMING_MS) return 1
  return 1 - (0.5 * (a - FULL_TIMING_MS)) / (ONSET_WINDOW_MS - FULL_TIMING_MS)
}

export function tabNotePoints(offsetMs: number): number {
  return Math.round(100 * timingFactor(offsetMs))
}

export interface JudgeNote {
  midi: number
  /** From the start of the song (after the count-in). */
  startMs: number
  durationMs: number
}

export interface JudgedNote {
  index: number
  hit: boolean
  /** Positive = late; null for a miss. */
  offsetMs: number | null
  points: number
}

/**
 * Judges a tab played at tempo. Feed every mic frame with its time from the song's start; each
 * push returns the notes it decided. A note is hit when its pitch is held long enough, starting
 * within ±150 ms of its onset (after the detection latency).
 */
export class TabJudge {
  private index = 0
  /** The pitch being held now and when it started (latency-corrected). */
  private run: { midi: number; startMs: number } | null = null

  constructor(
    private readonly notes: readonly JudgeNote[],
    private readonly config: { toleranceCents: number; a4: number },
  ) {}

  get done(): boolean {
    return this.index >= this.notes.length
  }

  /** Index of the next note to be judged. */
  get current(): number {
    return this.index
  }

  push(freq: number | null, timeMs: number): JudgedNote[] {
    const t = timeMs - DETECTION_LATENCY_MS
    const heard = freq === null ? null : freqToMidi(freq, this.config.a4)
    const midi =
      heard !== null && Math.abs(heard.cents) <= this.config.toleranceCents ? heard.midi : null
    if (midi === null) this.run = null
    else if (this.run?.midi !== midi) this.run = { midi, startMs: t }

    const judged: JudgedNote[] = []
    while (this.index < this.notes.length) {
      const note = this.notes[this.index]
      const onset = this.onsetFor(this.index)
      const inWindow = onset !== null && Math.abs(onset - note.startMs) <= ONSET_WINDOW_MS
      if (inWindow && t - onset >= requiredHoldMs(note.durationMs)) {
        const offsetMs = onset - note.startMs
        judged.push({ index: this.index, hit: true, offsetMs, points: tabNotePoints(offsetMs) })
      } else if (!inWindow && t > note.startMs + ONSET_WINDOW_MS) {
        judged.push({ index: this.index, hit: false, offsetMs: null, points: 0 })
      } else {
        break
      }
      this.index++
    }
    return judged
  }

  /**
   * When the held pitch started, for note `i`. The mic can't reliably hear a tongued repeat, so
   * a repeated pitch that is still sounding from the note before counts as starting on time.
   */
  private onsetFor(i: number): number | null {
    const note = this.notes[i]
    if (!this.run || this.run.midi !== note.midi) return null
    const previous = this.notes[i - 1]
    const early = this.run.startMs < note.startMs - ONSET_WINDOW_MS
    if (early && previous?.midi === note.midi) return note.startMs
    return this.run.startMs
  }
}

/**
 * "Wait for me": the lane moves at tempo but stops at the next note until it has been played.
 * Positions are in beats along the lane.
 */
export class WaitClock {
  private fromBeat = 0
  private fromMs: number

  constructor(
    startMs: number,
    private readonly beatMs: number,
  ) {
    this.fromMs = startMs
  }

  position(nowMs: number, stopBeat: number): number {
    return Math.min(stopBeat, this.fromBeat + Math.max(0, nowMs - this.fromMs) / this.beatMs)
  }

  /** The awaited note was played: carry on at tempo from where the lane is now. */
  release(nowMs: number, stopBeat: number): void {
    this.fromBeat = this.position(nowMs, stopBeat)
    this.fromMs = nowMs
  }
}
