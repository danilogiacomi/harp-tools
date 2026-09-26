import { useSettings } from '../settings/SettingsContext'
import { KeySelector } from './KeySelector'
import styles from './Header.module.css'

export function Header() {
  const { settings, update } = useSettings()
  return (
    <header className={styles.header}>
      <a href="#/" className={styles.brand}>
        🎵 Harp Tools
      </a>
      <nav className={styles.nav} aria-label="Main">
        <a href="#/tuner">Tuner</a>
        <a href="#/metronome">Metronome</a>
      </nav>
      <KeySelector value={settings.key} onChange={(key) => update({ key })} />
    </header>
  )
}
