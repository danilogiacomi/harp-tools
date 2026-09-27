import { echoRoundConfig } from './echoNote'
import type { ListenRoundConfig } from './listenRound'
import type { MatcherConfig } from './noteMatcher'
import type { GameMode } from './session'

/**
 * Spec §3: Echo's timing (8 s per note when scored) without Echo's automatic help — in practice
 * the player asks for help with "Show me".
 */
export function holeFinderRoundConfig(
  mode: GameMode,
  matcher: MatcherConfig,
  a4: number,
): ListenRoundConfig {
  return { ...echoRoundConfig(mode, matcher, a4), helpAfterMs: null }
}
