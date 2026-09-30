import { useEffect, useRef, type ReactNode } from 'react'
import styles from './Game.module.css'

export type SlotState = 'todo' | 'current' | 'done' | 'wrong'

export interface NoteSlot {
  label: ReactNode
  state: SlotState
}

/** The row's scrollLeft that brings a slot into view, or null when it is already visible. */
export function scrollLeftToShow(
  slot: { left: number; width: number },
  view: { scrollLeft: number; width: number },
  margin = 8,
): number | null {
  const visible = slot.left >= view.scrollLeft && slot.left + slot.width <= view.scrollLeft + view.width
  return visible ? null : Math.max(0, slot.left - margin)
}

/**
 * A row of note slots (a melody phrase, a lick, the tab reader's next notes). The row is always
 * rendered at a fixed height, so filling or emptying it never moves the page. A long row scrolls
 * itself (never the page) to keep the current slot in view.
 */
export function NoteSlots({ label, slots }: { label: string; slots: readonly NoteSlot[] }) {
  const listRef = useRef<HTMLOListElement>(null)
  const current = slots.findIndex((s) => s.state === 'current')

  useEffect(() => {
    const list = listRef.current
    const slot = current >= 0 ? (list?.children[current] as HTMLElement | undefined) : undefined
    if (!list || !slot) return
    const left = scrollLeftToShow(
      { left: slot.offsetLeft, width: slot.offsetWidth },
      { scrollLeft: list.scrollLeft, width: list.clientWidth },
    )
    if (left !== null) list.scrollLeft = left
  }, [current])

  return (
    <ol ref={listRef} className={styles.slots} aria-label={label}>
      {slots.map((s, i) => (
        <li key={i} className={styles.slot} data-state={s.state}>
          {s.label}
        </li>
      ))}
    </ol>
  )
}
