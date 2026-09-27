import styles from './BendMeter.module.css'

interface Props {
  /** [unbent, 1-step bend, 2-step bend, …] */
  labels: readonly string[]
  /** Index into labels of the bend to hit. */
  target: number
  /** Live pitch in semitones below the unbent note; null for silence. */
  depth: number | null
}

/** Spec §8.3: unbent note at the top, each bend step as a marker, the live pitch as a dot. */
export function BendMeter({ labels, target, depth }: Props) {
  const steps = labels.length - 1
  const top = (d: number) =>
    `${((Math.min(steps + 0.5, Math.max(-0.5, d)) + 0.5) / (steps + 1)) * 100}%`
  return (
    <div className={styles.meter} aria-label="Bend meter">
      {labels.map((label, i) => (
        <div
          key={label}
          className={styles.marker}
          data-testid="bend-marker"
          data-target={i === target || undefined}
          style={{ top: top(i) }}
        >
          {label}
        </div>
      ))}
      {depth !== null && (
        <div className={styles.dot} data-testid="bend-dot" style={{ top: top(depth) }} />
      )}
    </div>
  )
}
