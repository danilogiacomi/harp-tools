import type { ListenRoundConfig, ListenRoundState } from './listenRound'
import type { MatcherConfig } from './noteMatcher'
import { pickOne, type Rng } from './random'
import { roundPoints, speedBonus, type GameMode } from './session'

/** Spec §8.2: 8 s per note in scored mode. */
export const ECHO_LIMIT_MS = 8000
/** Spec §8.2: "after ~3 s of wrong attempts" in practice. */
export const ECHO_HELP_AFTER_MS = 3000

/** A random pitch from the pool, not the same as the last one when there is a choice. */
export function pickTarget(midis: readonly number[], rng: Rng, previous: number | null): number {
  const choices =
    midis.length > 1 && previous !== null ? midis.filter((m) => m !== previous) : midis
  return pickOne(choices, rng)
}

export function echoRoundConfig(
  mode: GameMode,
  matcher: MatcherConfig,
  a4: number,
): ListenRoundConfig {
  return {
    matcher,
    a4,
    limitMs: mode === 'scored' ? ECHO_LIMIT_MS : null,
    helpAfterMs: mode === 'practice' ? ECHO_HELP_AFTER_MS : null,
  }
}

export function echoPoints(state: ListenRoundState): number {
  if (state.status !== 'hit' || state.timeMs === null) return 0
  return roundPoints(1, speedBonus(state.timeMs, ECHO_LIMIT_MS))
}
