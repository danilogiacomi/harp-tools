import { formatCents, tuneQuality } from './tunerMath'
import styles from './TunerReadout.module.css'

export interface ReadoutData {
  noteLabel: string
  cents: number
  freq: number
  /** Tab labels of every hole producing this pitch. */
  tabs: string[]
  onHarp: boolean
}

export function TunerReadout({ reading }: { reading: ReadoutData | null }) {
  // The idle state keeps every row of the live layout, so the page doesn't jump as notes come and go.
  if (!reading) {
    return (
      <div className={styles.readout}>
        <div className={styles.note}>–</div>
        <div className={styles.scale} aria-hidden>
          <div className={styles.zone} />
        </div>
        <div className={styles.meta} aria-hidden>
          <span>–¢</span>
          <span>– Hz</span>
        </div>
        <p className={styles.tabs}>
          <span className={styles.hint}>Play a note…</span>
        </p>
      </div>
    )
  }
  const quality = tuneQuality(reading.cents)
  const needle = 50 + Math.max(-50, Math.min(50, reading.cents))
  return (
    <div className={styles.readout}>
      <div className={styles.note} data-quality={quality}>
        {reading.noteLabel}
      </div>
      <div className={styles.scale} aria-hidden>
        <div className={styles.zone} />
        <div className={styles.needle} data-quality={quality} style={{ left: `${needle}%` }} />
      </div>
      <div className={styles.meta}>
        <span>{formatCents(reading.cents)}</span>
        <span>{reading.freq.toFixed(1)} Hz</span>
      </div>
      <p className={styles.tabs}>
        {reading.onHarp ? (
          reading.tabs.map((t) => (
            <span key={t} className={styles.tab}>
              {t}
            </span>
          ))
        ) : (
          <span className={styles.offHarp}>Not on this harp</span>
        )}
      </p>
    </div>
  )
}
