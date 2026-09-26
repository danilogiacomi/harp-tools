import { NOISE_FLOOR_RANGE } from '../../settings/settings'
import { levelPercent } from './tunerMath'
import styles from './LevelMeter.module.css'

interface Props {
  rms: number
  noiseFloor: number
  onNoiseFloorChange: (noiseFloor: number) => void
}

const toDb = (v: number) => Math.round(20 * Math.log10(v))
const fromDb = (db: number) => 10 ** (db / 20)

export function LevelMeter({ rms, noiseFloor, onNoiseFloorChange }: Props) {
  const [lo, hi] = NOISE_FLOOR_RANGE
  return (
    <div className={styles.wrap}>
      <div
        className={styles.meter}
        aria-label="Input level"
        role="meter"
        aria-valuenow={levelPercent(rms)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={styles.bar}
          data-active={rms >= noiseFloor || undefined}
          style={{ width: `${levelPercent(rms)}%` }}
        />
        <div className={styles.floor} style={{ left: `${levelPercent(noiseFloor)}%` }} />
      </div>
      <label className={styles.label}>
        Noise gate
        <input
          type="range"
          min={toDb(lo)}
          max={toDb(hi)}
          step={1}
          value={toDb(noiseFloor)}
          onChange={(e) => onNoiseFloorChange(fromDb(Number(e.target.value)))}
        />
        <span>{toDb(noiseFloor)} dB</span>
      </label>
    </div>
  )
}
