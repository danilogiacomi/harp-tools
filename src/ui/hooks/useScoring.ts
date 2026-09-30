import { useState } from 'react'
import {
  MAX_ROUND_POINTS,
  SCORED_ROUNDS,
  isFinished,
  maxScore,
  recordRound,
  sessionScore,
  startSession,
  type GameMode,
  type RoundResult,
  type SessionState,
} from '../../core/games/session'
import { appendSession } from '../log/practiceLog'
import { loadBest, saveBestIfHigher } from '../scores/bestScores'
import { browserStorage } from '../settings/settings'
import { Slot } from './useSlot'

export interface Scoring {
  session: SessionState
  best: number | null
  newBest: boolean
  /** Records a round; returns the updated session (check isFinished on it). */
  record(result: RoundResult): SessionState
  restart(): void
}

/**
 * A page's session plus its best score for `bestKey`, saved when a scored session ends.
 * `roundMax` is the most one round can earn (see `startSession`). `logMax`, when given, is the
 * practice log's maximum for a finished session, for games whose best possible score is less
 * than rounds × round max (Harp Hero's multiplier).
 */
export function useScoring(
  mode: GameMode,
  bestKey: string,
  totalRounds = SCORED_ROUNDS,
  roundMax = MAX_ROUND_POINTS,
  logMax?: number,
): Scoring {
  const [session, setSession] = useState(() => startSession(mode, totalRounds, roundMax))
  const [best, setBest] = useState(() => loadBest(browserStorage(), bestKey))
  const [newBest, setNewBest] = useState(false)
  // The newest session, even before React re-renders (two records in one frame both count).
  const [latest] = useState(() => new Slot<SessionState>())

  const record = (result: RoundResult): SessionState => {
    const current = latest.get() ?? session
    const next = recordRound(current, result)
    if (next === current) return current
    latest.set(next)
    setSession(next)
    if (isFinished(next)) {
      const score = sessionScore(next)
      // Spec §5: every finished scored session goes to the practice log. The game id is the
      // best-score key's first segment ("echo|key=C|…" → "echo").
      appendSession(
        browserStorage(),
        { game: bestKey.split('|')[0], score, max: logMax ?? maxScore(next) },
        Date.now(),
      )
      if (score > 0 && saveBestIfHigher(browserStorage(), bestKey, score)) {
        setBest(score)
        setNewBest(true)
      }
    }
    return next
  }

  const restart = () => {
    const fresh = startSession(mode, totalRounds, roundMax)
    latest.set(fresh)
    setSession(fresh)
    setNewBest(false)
  }

  return { session, best, newBest, record, restart }
}
