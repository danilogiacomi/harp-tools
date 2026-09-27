import type { ReactNode } from 'react'
import styles from './Game.module.css'

export type SlotState = 'todo' | 'current' | 'done' | 'wrong'

export interface NoteSlot {
  label: ReactNode
  state: SlotState
}

/**
 * A row of note slots (a melody phrase, a lick, the tab reader's next notes). The row is always
 * rendered at a fixed height, so filling or emptying it never moves the page.
 */
export function NoteSlots({ label, slots }: { label: string; slots: readonly NoteSlot[] }) {
  return (
    <ol className={styles.slots} aria-label={label}>
      {slots.map((s, i) => (
        <li key={i} className={styles.slot} data-state={s.state}>
          {s.label}
        </li>
      ))}
    </ol>
  )
}
