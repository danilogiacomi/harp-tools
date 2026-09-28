import { useRef } from 'react'
import { HISTORY_MS, tracePath, type ToneHistory } from '../../../core/tone/history'
import { useAnimationFrame } from '../../hooks/useAnimationFrame'
import styles from './ToneMeterPage.module.css'

const W = 600
const H = 200
/** Spec §8: redrawn at 30 fps. */
const FRAME_MS = 1000 / 30 - 3

interface Props {
  history: ToneHistory
  now: () => number
}

/**
 * The rolling 6-second chart. Its lines are updated through refs on animation frames, so the
 * page doesn't re-render for them; the stats panel is the text alternative.
 */
export function ToneChart({ history, now }: Props) {
  const pitch = useRef<SVGPathElement>(null)
  const level = useRef<SVGPathElement>(null)

  useAnimationFrame(() => {
    const box = { nowMs: now(), windowMs: HISTORY_MS, width: W, height: H }
    pitch.current?.setAttribute(
      'd',
      tracePath(history.points, 'cents', { ...box, range: [-50, 50] }),
    )
    level.current?.setAttribute('d', tracePath(history.points, 'db', { ...box, range: [-60, 0] }))
  }, FRAME_MS)

  return (
    <figure className={styles.figure}>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Pitch and level over the last 6 seconds"
      >
        <line className={styles.grid} x1={0} x2={W} y1={H / 4} y2={H / 4} />
        <line className={styles.center} x1={0} x2={W} y1={H / 2} y2={H / 2} />
        <line className={styles.grid} x1={0} x2={W} y1={(3 * H) / 4} y2={(3 * H) / 4} />
        <path ref={level} className={styles.level} />
        <path ref={pitch} className={styles.pitch} />
      </svg>
      <figcaption className={styles.legend}>
        <span className={styles.pitchKey}>Pitch, ±50¢ (centre line = in tune)</span>
        <span className={styles.levelKey}>Level, −60 to 0 dB</span>
      </figcaption>
    </figure>
  )
}
