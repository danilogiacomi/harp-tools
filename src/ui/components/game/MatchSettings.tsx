import { HOLD_RANGE, MELODY_HOLD_RANGE, TOLERANCE_RANGE } from '../../settings/settings'
import { useSettings } from '../../settings/SettingsContext'
import styles from './Game.module.css'

/** Spec §3/§8.1: the matcher thresholds, shared by all games and saved with the settings. */
export function MatchSettings({ melodyHold = false }: { melodyHold?: boolean }) {
  const { settings, update } = useSettings()
  return (
    <details className={styles.settings}>
      <summary>Note matching</summary>
      <label className={styles.field}>
        Tolerance
        <input
          type="range"
          min={TOLERANCE_RANGE[0]}
          max={TOLERANCE_RANGE[1]}
          step={1}
          value={settings.toleranceCents}
          onChange={(e) => update({ toleranceCents: Number(e.target.value) })}
        />
        <span>±{settings.toleranceCents}¢</span>
      </label>
      <label className={styles.field}>
        Hold time
        <input
          type="range"
          min={HOLD_RANGE[0]}
          max={HOLD_RANGE[1]}
          step={50}
          value={settings.holdMs}
          onChange={(e) => update({ holdMs: Number(e.target.value) })}
        />
        <span>{settings.holdMs} ms</span>
      </label>
      {melodyHold && (
        <label className={styles.field}>
          Melody hold
          <input
            type="range"
            min={MELODY_HOLD_RANGE[0]}
            max={MELODY_HOLD_RANGE[1]}
            step={50}
            value={settings.melodyHoldMs}
            onChange={(e) => update({ melodyHoldMs: Number(e.target.value) })}
          />
          <span>{settings.melodyHoldMs} ms</span>
        </label>
      )}
      <p className={styles.hint}>Changing these restarts the current game.</p>
    </details>
  )
}
