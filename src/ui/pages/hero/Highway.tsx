import { useRef } from 'react'
import type { Grade } from '../../../core/arcade/arcadeScore'
import type { Hole, Technique } from '../../../core/harmonica/harp'
import type { TimedNote } from '../../../core/tab/parseTab'
import { TECHNIQUE_COLOR } from '../../components/HarmonicaDiagram'
import { TabText } from '../../components/TabText'
import { useAnimationFrame } from '../../hooks/useAnimationFrame'
import styles from './Highway.module.css'

/** Spec §2.2: the scroll speed is per beat, so faster tracks scroll faster. */
export const PX_PER_BEAT = 48

export type NoteState = 'todo' | Grade

const HOLES: readonly Hole[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
/** Blown notes are drawn hollow and drawn notes solid, so shape tells them apart too. */
const BLOWN: ReadonlySet<Technique> = new Set(['blow', 'blowBend', 'overblow'])

interface Props {
  notes: readonly TimedNote[]
  /** Beats before the song's first bar. */
  countInBeats: number
  totalBars: number
  beatsPerBar: number
  /** Every this many bars the rule is stronger: a new chorus. */
  barsPerChorus: number
  /** One per note. */
  states: readonly NoteState[]
  /** Where the strike line is, in beats since the count-in started. Read on every frame. */
  position: () => number
}

/**
 * Spec §2: one lane per hole, rendered in the harmonica chart's grid (its `header`) so each
 * lane sits exactly above its hole. The notes fall by one CSS variable set on every frame, so
 * the page never re-renders to move them.
 */
export function Highway({
  notes,
  countInBeats,
  totalBars,
  beatsPerBar,
  barsPerChorus,
  states,
  position,
}: Props) {
  const root = useRef<HTMLDivElement>(null)
  useAnimationFrame(() => {
    root.current?.style.setProperty('--offset', `${position() * PX_PER_BEAT}px`)
  })
  const at = (beats: number) => beats * PX_PER_BEAT

  return (
    <div ref={root} className={styles.highway} aria-hidden>
      <div className={styles.spacer} />
      {HOLES.map((hole) => (
        <div key={hole} className={styles.lane} data-hole={hole}>
          <div className={styles.track}>
            {notes.map((n, i) =>
              n.note.hole !== hole ? null : (
                <div
                  key={i}
                  className={styles.note}
                  data-color={TECHNIQUE_COLOR[n.note.technique]}
                  data-breath={BLOWN.has(n.note.technique) ? 'blow' : 'draw'}
                  data-state={states[i]}
                  style={{
                    bottom: at(countInBeats + n.startBeat),
                    height: at(n.beats) - 4,
                  }}
                >
                  <TabText tab={n.tab} />
                </div>
              ),
            )}
          </div>
        </div>
      ))}
      <div className={styles.rules}>
        <div className={styles.track}>
          <div className={styles.countIn} style={{ bottom: 0, height: at(countInBeats) }}>
            count-in
          </div>
          {Array.from({ length: totalBars + 1 }, (_, k) => (
            <div
              key={k}
              className={styles.rule}
              data-chorus={k % barsPerChorus === 0 ? 'true' : undefined}
              style={{ bottom: at(countInBeats + k * beatsPerBar) }}
            />
          ))}
        </div>
        <div className={styles.strike} />
      </div>
    </div>
  )
}
