import type { GameMode } from '../games/session'
import { FULL_TIMING_MS, tabNotePoints, type JudgedNote } from '../tab/tabJudge'

export type Grade = 'perfect' | 'good' | 'miss'

/** Spec §3.1: Perfect within ±50 ms of the beat, Good up to ±150 ms, Miss otherwise. */
export function gradeOf(note: JudgedNote): Grade {
  if (!note.hit || note.offsetMs === null) return 'miss'
  return Math.abs(note.offsetMs) <= FULL_TIMING_MS ? 'perfect' : 'good'
}

/** 100 for a Perfect; a Good follows the Tab reader's timing slope, 50–99. */
export function basePoints(note: JudgedNote): number {
  const grade = gradeOf(note)
  if (grade === 'miss') return 0
  return grade === 'perfect' ? 100 : Math.min(99, tabNotePoints(note.offsetMs ?? 0))
}

/** Spec §3.2: ×1 for the first 9 notes of a streak, then ×2 from 10, ×3 from 20, ×4 from 30. */
export function multiplier(combo: number): number {
  return Math.min(4, 1 + Math.floor(combo / 10))
}

/** What an all-Perfect run of `noteCount` notes scores. */
export function maxScore(noteCount: number): number {
  let total = 0
  for (let i = 0; i < noteCount; i++) total += 100 * multiplier(i)
  return total
}

export const METER_START = 50
const METER_CHANGE: Record<Grade, number> = { perfect: 3, good: 2, miss: -8 }

export interface ArcadeState {
  readonly score: number
  readonly combo: number
  readonly longest: number
  /** The rock meter, 0–100 (spec §3.3). */
  readonly meter: number
  readonly counts: Readonly<Record<Grade, number>>
  /** Scored mode only: the meter ran out (spec §3.4). */
  readonly failed: boolean
}

export function startArcade(): ArcadeState {
  return {
    score: 0,
    combo: 0,
    longest: 0,
    meter: METER_START,
    counts: { perfect: 0, good: 0, miss: 0 },
    failed: false,
  }
}

export interface ArcadeStep {
  state: ArcadeState
  grade: Grade
  /** What this note earned: its base points × the multiplier of the combo before it. */
  points: number
}

export function scoreNote(s: ArcadeState, note: JudgedNote, mode: GameMode): ArcadeStep {
  const grade = gradeOf(note)
  const points = basePoints(note) * multiplier(s.combo)
  const combo = grade === 'miss' ? 0 : s.combo + 1
  const meter = Math.min(100, Math.max(0, s.meter + METER_CHANGE[grade]))
  return {
    grade,
    points,
    state: {
      score: s.score + points,
      combo,
      longest: Math.max(s.longest, combo),
      meter,
      counts: { ...s.counts, [grade]: s.counts[grade] + 1 },
      failed: s.failed || (mode === 'scored' && meter === 0),
    },
  }
}

export function meterLevel(meter: number): 'low' | 'mid' | 'high' {
  return meter < 25 ? 'low' : meter < 50 ? 'mid' : 'high'
}

/** Spec §3.5: one star for finishing, more at 40, 60, 80 and 95 % of the best possible score. */
export function stars(score: number | null, max: number): number {
  if (score === null || max <= 0) return 0
  const share = score / max
  if (share >= 0.95) return 5
  if (share >= 0.8) return 4
  if (share >= 0.6) return 3
  if (share >= 0.4) return 2
  return 1
}

export function starText(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}
