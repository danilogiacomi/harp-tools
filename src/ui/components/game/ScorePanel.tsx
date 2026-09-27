import { correctCount, isFinished, maxScore, sessionScore } from '../../../core/games/session'
import type { Scoring } from '../../hooks/useScoring'
import styles from './Game.module.css'

interface Props {
  scoring: Scoring
  onRestart: () => void
}

export function ScorePanel({ scoring, onRestart }: Props) {
  const { session, best, newBest } = scoring
  if (session.mode !== 'scored') return null
  const score = sessionScore(session)

  if (isFinished(session)) {
    return (
      <div className={styles.summary} role="status">
        <strong>
          Final score: {score} / {maxScore(session)}
        </strong>
        <span>
          {correctCount(session)} of {session.totalRounds} correct
        </span>
        {newBest ? <span>🏆 New best score!</span> : best !== null && <span>Best: {best}</span>}
        <button type="button" onClick={onRestart}>
          Play again
        </button>
      </div>
    )
  }

  const round = Math.min(session.results.length + 1, session.totalRounds)
  return (
    <p className={styles.score} role="status">
      Round {round} of {session.totalRounds} · Score {score} · Best {best ?? '—'}
    </p>
  )
}
