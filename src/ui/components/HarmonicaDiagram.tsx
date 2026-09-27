import type { KeyboardEvent, PointerEvent } from 'react'
import { noteId, tabLabel, type HarpNote, type Technique } from '../../core/harmonica/harp'
import { diagramLayout, type DiagramRow } from '../../core/harmonica/layout'
import { noteName, type Spelling } from '../../core/music/noteNames'
import type { LabelMode } from '../settings/settings'
import styles from './HarmonicaDiagram.module.css'

export type Highlight = 'detected' | 'target' | 'correct' | 'wrong'

interface Props {
  harp: readonly HarpNote[]
  spelling: Spelling
  labelMode: LabelMode
  showAdvanced: boolean
  /** Keyed by noteId(note). */
  highlights?: ReadonlyMap<string, Highlight>
  onNoteDown?: (note: HarpNote) => void
  onNoteUp?: (note: HarpNote) => void
  /** Games where the note is the answer: hide it from every cell's accessible name too. */
  concealNotes?: boolean
}

const COLOR: Record<Technique, string> = {
  blow: 'blow',
  draw: 'draw',
  blowBend: 'bend',
  drawBend: 'bend',
  overblow: 'overblow',
  overdraw: 'overdraw',
}

/** A plain technique description, with no pitch — for `concealNotes`. */
const TECHNIQUE_WORDS: Record<Technique, string> = {
  blow: 'blow',
  draw: 'draw',
  blowBend: 'blow bend',
  drawBend: 'draw bend',
  overblow: 'overblow',
  overdraw: 'overdraw',
}

const LEGEND = [
  ['blow', 'Blow'],
  ['draw', 'Draw'],
  ['bend', 'Bend'],
  ['overblow', 'Overblow'],
  ['overdraw', 'Overdraw'],
] as const

const HOLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export function HarmonicaDiagram({
  harp,
  spelling,
  labelMode,
  showAdvanced,
  highlights,
  onNoteDown,
  onNoteUp,
  concealNotes = false,
}: Props) {
  const { above, below } = diagramLayout(harp, showAdvanced)

  const cell = (note: HarpNote | null, rowId: string, i: number) => {
    if (!note) return <div key={`${rowId}-${i}`} />
    const name = noteName(note.midi, spelling)
    const tab = tabLabel(note)
    const isKey = (e: KeyboardEvent) => e.key === 'Enter' || e.key === ' '
    const highlight = highlights?.get(noteId(note))
    return (
      <button
        key={noteId(note)}
        type="button"
        className={styles.cell}
        data-color={COLOR[note.technique]}
        data-advanced={note.common ? undefined : 'true'}
        data-highlight={highlight}
        data-interactive={onNoteDown ? 'true' : undefined}
        aria-current={highlight === 'target' ? 'true' : undefined}
        aria-label={concealNotes ? `${tab} ${TECHNIQUE_WORDS[note.technique]}` : `${tab} ${name}`}
        onPointerDown={(e) => e.button === 0 && onNoteDown?.(note)}
        onPointerUp={() => onNoteUp?.(note)}
        onPointerCancel={() => onNoteUp?.(note)}
        onPointerLeave={(e: PointerEvent) => e.buttons > 0 && onNoteUp?.(note)}
        onKeyDown={(e) => isKey(e) && !e.repeat && onNoteDown?.(note)}
        onKeyUp={(e) => isKey(e) && onNoteUp?.(note)}
      >
        {labelMode === 'note' ? name : tab}
      </button>
    )
  }

  const row = (r: DiagramRow) => [
    <div key={`${r.id}-label`} className={styles.rowLabel}>
      {r.label}
    </div>,
    ...r.cells.map((n, i) => cell(n, r.id, i)),
  ]

  return (
    <div className={styles.wrap}>
      <div className={styles.grid} role="group" aria-label="Harmonica chart">
        {above.flatMap(row)}
        <div className={styles.rowLabel}>Hole</div>
        {HOLES.map((h) => (
          <div key={`hole-${h}`} className={styles.hole} data-testid={`hole-${h}`}>
            {h}
          </div>
        ))}
        {below.flatMap(row)}
      </div>
      <ul className={styles.legend} aria-label="Legend">
        {LEGEND.map(([color, label]) => (
          <li key={color}>
            <span className={styles.swatch} data-color={color} />
            {label}
          </li>
        ))}
        {showAdvanced && (
          <li>
            <span className={styles.swatch} data-advanced="true" />
            Advanced
          </li>
        )}
      </ul>
    </div>
  )
}
