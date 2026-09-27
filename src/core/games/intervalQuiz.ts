import { INTERVALS, type Interval, type IntervalId } from '../music/intervals'
import type { ListenRoundConfig, ListenRoundState } from './listenRound'
import type { MatcherConfig } from './noteMatcher'
import { pickOne, type Rng } from './random'
import { roundPoints, speedBonus, type GameMode } from './session'

/** Always ascending: `high = low + interval.semitones` (decision 8). */
export interface IntervalQuestion {
  low: number
  high: number
  interval: Interval
}

export const INTERVAL_NAME_LIMIT_MS = 10000
export const INTERVAL_PLAY_LIMIT_MS = 8000

/** Low notes of the pool that have a note `semitones` above them in the pool. */
export function intervalPairs(midis: readonly number[], semitones: number): number[] {
  const set = new Set(midis)
  return [...set].sort((a, b) => a - b).filter((m) => set.has(m + semitones))
}

export function makeIntervalQuestion(
  midis: readonly number[],
  allowed: readonly IntervalId[],
  rng: Rng,
): IntervalQuestion | null {
  const candidates = INTERVALS.filter(
    (i) => allowed.includes(i.id) && intervalPairs(midis, i.semitones).length > 0,
  )
  if (candidates.length === 0) return null
  const interval = pickOne(candidates, rng)
  const low = pickOne(intervalPairs(midis, interval.semitones), rng)
  return { low, high: low + interval.semitones, interval }
}

export function answerPoints(correct: boolean, timeMs: number): number {
  return correct ? roundPoints(1, speedBonus(timeMs, INTERVAL_NAME_LIMIT_MS)) : 0
}

export function playRoundConfig(
  mode: GameMode,
  matcher: MatcherConfig,
  a4: number,
): ListenRoundConfig {
  return {
    matcher,
    a4,
    limitMs: mode === 'scored' ? INTERVAL_PLAY_LIMIT_MS : null,
    helpAfterMs: null,
  }
}

export function playPoints(state: ListenRoundState): number {
  if (state.status !== 'hit' || state.timeMs === null) return 0
  return roundPoints(1, speedBonus(state.timeMs, INTERVAL_PLAY_LIMIT_MS))
}
