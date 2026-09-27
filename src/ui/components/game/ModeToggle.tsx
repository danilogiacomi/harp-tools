import type { GameMode } from '../../../core/games/session'
import styles from './Game.module.css'

interface Props {
  mode: GameMode
  onChange: (mode: GameMode) => void
}

export function ModeToggle({ mode, onChange }: Props) {
  return (
    <div role="group" aria-label="Mode" className={styles.segmented}>
      <button type="button" aria-pressed={mode === 'practice'} onClick={() => onChange('practice')}>
        Practice
      </button>
      <button type="button" aria-pressed={mode === 'scored'} onClick={() => onChange('scored')}>
        Scored
      </button>
    </div>
  )
}
