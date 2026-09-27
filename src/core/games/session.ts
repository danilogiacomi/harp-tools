export type GameMode = 'practice' | 'scored'

export const SCORED_ROUNDS = 10
/** 100 × full accuracy × the maximum speed bonus of 2. */
export const MAX_ROUND_POINTS = 200

/** 2 for an instant answer, falling linearly to 1 at the time limit. */
export function speedBonus(timeMs: number, limitMs: number): number {
  if (limitMs <= 0) return 1
  return 1 + Math.min(1, Math.max(0, 1 - timeMs / limitMs))
}

/** Spec §8.1: points = accuracy × speed bonus (scaled to 0–200 per round). */
export function roundPoints(accuracy: number, bonus: number): number {
  return Math.round(100 * Math.min(1, Math.max(0, accuracy)) * bonus)
}

export interface RoundResult {
  correct: boolean
  points: number
}

export interface SessionState {
  readonly mode: GameMode
  readonly totalRounds: number
  readonly results: readonly RoundResult[]
}

export function startSession(mode: GameMode, totalRounds = SCORED_ROUNDS): SessionState {
  return { mode, totalRounds, results: [] }
}

export function isFinished(s: SessionState): boolean {
  return s.mode === 'scored' && s.results.length >= s.totalRounds
}

export function recordRound(s: SessionState, r: RoundResult): SessionState {
  if (isFinished(s)) return s
  const result = s.mode === 'scored' ? r : { ...r, points: 0 }
  return { ...s, results: [...s.results, result] }
}

export function sessionScore(s: SessionState): number {
  return s.results.reduce((sum, r) => sum + r.points, 0)
}

export function correctCount(s: SessionState): number {
  return s.results.filter((r) => r.correct).length
}

export function maxScore(s: SessionState): number {
  return s.totalRounds * MAX_ROUND_POINTS
}
