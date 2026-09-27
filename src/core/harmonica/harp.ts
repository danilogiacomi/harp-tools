import { keyOffset, type HarpKey } from './keys'
import { tuningById, type TuningId } from './tunings'

export type Hole = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
export type Technique = 'blow' | 'draw' | 'drawBend' | 'blowBend' | 'overblow' | 'overdraw'
export type BendSteps = 0 | 1 | 2 | 3

export interface HarpNote {
  readonly hole: Hole
  readonly technique: Technique
  /** Semitones bent below the unbent note; 0 for anything that isn't a bend. */
  readonly bendSteps: BendSteps
  readonly midi: number
  /** False for over-notes most harps can't play reliably ("advanced"). */
  readonly common: boolean
}

const COMMON_OVERBLOWS: ReadonlySet<number> = new Set([1, 4, 5, 6])
const COMMON_OVERDRAWS: ReadonlySet<number> = new Set([7, 9, 10])

/**
 * Every note of a harp whose holes 1–10 have these blow and draw reeds (MIDI on a C harp),
 * transposed by `offset` semitones.
 */
export function harpFromReeds(
  blowReeds: readonly number[],
  drawReeds: readonly number[],
  offset: number,
): HarpNote[] {
  const notes: HarpNote[] = []
  for (let i = 0; i < 10; i++) {
    const hole = (i + 1) as Hole
    const blow = blowReeds[i] + offset
    const draw = drawReeds[i] + offset
    notes.push({ hole, technique: 'blow', bendSteps: 0, midi: blow, common: true })
    notes.push({ hole, technique: 'draw', bendSteps: 0, midi: draw, common: true })

    // Equal reeds: nothing to bend towards and no over-note.
    if (draw === blow) continue

    // Bends pull the higher reed down, one semitone per step, stopping short of the lower
    // reed. Over-notes sound a semitone above the higher reed.
    const gap = Math.abs(draw - blow)
    if (draw > blow) {
      for (let s = 1; s < gap; s++) {
        notes.push({
          hole,
          technique: 'drawBend',
          bendSteps: s as BendSteps,
          midi: draw - s,
          common: true,
        })
      }
      notes.push({
        hole,
        technique: 'overblow',
        bendSteps: 0,
        midi: draw + 1,
        common: COMMON_OVERBLOWS.has(hole),
      })
    } else {
      for (let s = 1; s < gap; s++) {
        notes.push({
          hole,
          technique: 'blowBend',
          bendSteps: s as BendSteps,
          midi: blow - s,
          common: true,
        })
      }
      notes.push({
        hole,
        technique: 'overdraw',
        bendSteps: 0,
        midi: blow + 1,
        common: COMMON_OVERDRAWS.has(hole),
      })
    }
  }
  return notes
}

/** The harp for `key` in `tuning` (spec §1); Richter unless told otherwise. */
export function buildHarp(key: HarpKey, tuning: TuningId = 'richter'): HarpNote[] {
  const t = tuningById(tuning)
  return harpFromReeds(t.blow, t.draw, keyOffset(key))
}

export function findNotes(harp: readonly HarpNote[], midi: number): HarpNote[] {
  return harp.filter((n) => n.midi === midi)
}

export function tabLabel(note: HarpNote): string {
  const ticks = "'".repeat(note.bendSteps)
  switch (note.technique) {
    case 'blow':
      return `${note.hole}`
    case 'draw':
      return `-${note.hole}`
    case 'drawBend':
      return `-${note.hole}${ticks}`
    case 'blowBend':
      return `${note.hole}${ticks}`
    case 'overblow':
      return `${note.hole}o`
    case 'overdraw':
      return `${note.hole}od`
  }
}

const BEND_DEPTH = ['', 'a half step', 'a whole step', 'a step and a half']

/** How to play a note in words, e.g. "Hole 3 · draw, bent a whole step (-3'')". */
export function describeNote(note: HarpNote): string {
  const how = {
    blow: 'blow',
    draw: 'draw',
    blowBend: `blow, bent ${BEND_DEPTH[note.bendSteps]}`,
    drawBend: `draw, bent ${BEND_DEPTH[note.bendSteps]}`,
    overblow: 'overblow',
    overdraw: 'overdraw',
  }[note.technique]
  return `Hole ${note.hole} · ${how} (${tabLabel(note)})`
}

export function noteId(note: HarpNote): string {
  return `${note.hole}:${note.technique}:${note.bendSteps}`
}
