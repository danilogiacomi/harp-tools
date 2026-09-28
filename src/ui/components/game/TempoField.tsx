import { BPM_MAX, BPM_MIN, clampBpm } from '../../../core/rhythm/tempo'
import { useSettings } from '../../settings/SettingsContext'
import styles from './Game.module.css'

interface Props {
  /** A page's own range inside the metronome's (the play-along: 60–160). */
  min?: number
  max?: number
}

/** The shared tempo setting (the metronome's BPM), set from a game's toolbar. */
export function TempoField({ min = BPM_MIN, max = BPM_MAX }: Props) {
  const { settings, update } = useSettings()
  const clamp = (bpm: number) => Math.min(max, Math.max(min, clampBpm(bpm)))
  const bpm = clamp(settings.bpm)
  return (
    <label className={styles.field}>
      Tempo
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={bpm}
        onChange={(e) => update({ bpm: clamp(Number(e.target.value)) })}
      />
      <span>{bpm} BPM</span>
    </label>
  )
}
