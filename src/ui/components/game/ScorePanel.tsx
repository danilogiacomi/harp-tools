import { correctCount, isFinished, maxScore, sessionScore } from '../../../core/games/session'
import type { Scoring } from '../../hooks/useScoring'
import styles from './Game.module.css'

/**
 * The scored session's status: round and score while playing, the summary once finished. Both
 * use the same two fixed-height lines, so finishing a session doesn't move the stage below.
 */
export function ScorePanel({ scoring }: { scoring: Scoring }) {
  const { session, best, newBest } = scoring
  if (session.mode !== 'scored') return null
  const score = sessionScore(session)

  if (isFinished(session)) {
    return (
      <div className={styles.score} role="status">
        <strong className={styles.scoreLine}>
          Final score: {score} / {maxScore(session)}
        </strong>
        <span className={styles.scoreLine}>
          {correctCount(session)} of {session.totalRounds} correct
          {newBest ? ' · 🏆 New best score!' : best !== null && ` · Best: ${best}`}
        </span>
      </div>
    )
  }

  const round = Math.min(session.results.length + 1, session.totalRounds)
  return (
    <div className={styles.score} role="status">
      <span className={styles.scoreLine}>
        Round {round} of {session.totalRounds} · Score {score} · Best {best ?? '—'}
      </span>
      <span className={styles.scoreLine} />
    </div>
  )
}

/** Starts a new scored session once one is finished; it goes in the stage's controls. */
export function PlayAgain({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className={styles.primary} onClick={onClick}>
      Play again
    </button>
  )
}
