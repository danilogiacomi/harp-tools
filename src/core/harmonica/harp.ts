import { keyOffset, type HarpKey } from './keys'

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

// Standard Richter C harmonica, holes 1–10, as MIDI numbers. Other keys transpose this.
const C_BLOW = [60, 64, 67, 72, 76, 79, 84, 88, 91, 96]
const C_DRAW = [62, 67, 71, 74, 77, 81, 83, 86, 89, 93]

const COMMON_OVERBLOWS: ReadonlySet<number> = new Set([1, 4, 5, 6])
const COMMON_OVERDRAWS: ReadonlySet<number> = new Set([7, 9, 10])

export function buildHarp(key: HarpKey): HarpNote[] {
  const offset = keyOffset(key)
  const notes: HarpNote[] = []
  for (let i = 0; i < 10; i++) {
    const hole = (i + 1) as Hole
    const blow = C_BLOW[i] + offset
    const draw = C_DRAW[i] + offset
    notes.push({ hole, technique: 'blow', bendSteps: 0, midi: blow, common: true })
    notes.push({ hole, technique: 'draw', bendSteps: 0, midi: draw, common: true })

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

export function noteId(note: HarpNote): string {
  return `${note.hole}:${note.technique}:${note.bendSteps}`
}
