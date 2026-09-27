import styles from './Game.module.css'

/** How much of the required hold time the player has held the target so far. */
export function HoldMeter({ progress }: { progress: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100)
  return (
    <div
      className={styles.hold}
      role="progressbar"
      aria-label="Hold"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <div className={styles.holdBar} style={{ width: `${pct}%` }} />
    </div>
  )
}
