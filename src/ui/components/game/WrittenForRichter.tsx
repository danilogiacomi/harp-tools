import { tuningById } from '../../../core/harmonica/tunings'
import { useSettings } from '../../settings/SettingsContext'
import styles from './Game.module.css'

/** Tabs are key-relative: on another tuning the same holes can play other notes. */
export function WrittenForRichter() {
  const { settings } = useSettings()
  if (settings.tuning === 'richter') return null
  return (
    <p className={styles.hint}>
      Written for a Richter harp — on {tuningById(settings.tuning).name} some notes sound different.
    </p>
  )
}
