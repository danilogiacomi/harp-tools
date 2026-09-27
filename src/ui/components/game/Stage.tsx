import type { ReactNode } from 'react'
import { HoldMeter } from './HoldMeter'
import styles from './Game.module.css'

interface Props {
  /** Left column: the buttons of the current phase, stacked; the primary action first. */
  controls: ReactNode
  /** Row 1: the prompt or the result. */
  headline?: ReactNode
  /** Colours the headline as a result. */
  result?: 'ok' | 'bad'
  /** Row 2: hold progress (0–1) while listening; undefined leaves the slot empty. */
  progress?: number
  /** Row 3: secondary text — time left, a hint, a reveal. */
  detail?: ReactNode
}

/**
 * The play area shared by every game. It has a fixed height and every row is always rendered
 * at a fixed size (text clips rather than grows), so nothing below it moves between phases.
 */
export function Stage({ controls, headline, result, progress, detail }: Props) {
  return (
    <div className={styles.stageSplit}>
      <div className={styles.controls}>{controls}</div>
      <div className={styles.status}>
        {result ? (
          <p className={`${styles.headline} ${styles.feedback}`} data-result={result}>
            {headline}
          </p>
        ) : (
          <p className={styles.headline}>{headline}</p>
        )}
        {progress !== undefined ? <HoldMeter progress={progress} /> : <div aria-hidden />}
        <p className={styles.detail}>{detail}</p>
      </div>
    </div>
  )
}
