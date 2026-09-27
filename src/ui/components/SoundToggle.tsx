import { useSettings } from '../settings/SettingsContext'
import styles from './game/Game.module.css'

/** Spec §6: Reed (default) or Pure reference notes, saved with the settings. */
export function SoundToggle() {
  const { settings, update } = useSettings()
  return (
    <div role="group" aria-label="Reference sound" className={styles.segmented}>
      <button
        type="button"
        aria-pressed={settings.sound === 'reed'}
        onClick={() => update({ sound: 'reed' })}
      >
        Reed
      </button>
      <button
        type="button"
        aria-pressed={settings.sound === 'pure'}
        onClick={() => update({ sound: 'pure' })}
      >
        Pure
      </button>
    </div>
  )
}
