import { noteId, type HarpNote } from '../harmonica/harp'
import { pitchClassName, type Spelling } from '../music/noteNames'
import { scaleById } from '../music/scales'

export type Degree = 'I' | 'IV' | 'V'

const DEGREE_SEMITONES: Record<Degree, number> = { I: 0, IV: 5, V: 7 }

/**
 * Spec §12: a 12-bar blues, I–IV–V, with the turnaround (I–V) in bars 11–12. The quick change
 * moves to IV in bar 2.
 */
export function bluesForm(quickChange: boolean): Degree[] {
  return ['I', quickChange ? 'IV' : 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V']
}

const pc = (n: number) => ((n % 12) + 12) % 12

export function chordRootPc(tonicPc: number, degree: Degree): number {
  return pc(tonicPc + DEGREE_SEMITONES[degree])
}

/** Root, major 3rd, 5th and minor 7th: the dominant-7th chord every blues bar uses. */
export const DOMINANT_7TH = [0, 4, 7, 10] as const

export function chordPcs(rootPc: number): number[] {
  return DOMINANT_7TH.map((i) => pc(rootPc + i))
}

/** "G7", "Bb7": the chord's name in the harp key's spelling. */
export function chordName(rootPc: number, spelling: Spelling): string {
  return `${pitchClassName(rootPc, spelling)}7`
}

export type JamMark = 'chord' | 'scale'

const BLUES = scaleById('blues').steps

/**
 * What the chart shows for the current bar (keyed by noteId): every harp note that is a tone of
 * the current chord, and the rest of the tonic's blues scale.
 */
export function jamMarks(
  harp: readonly HarpNote[],
  tonicPc: number,
  rootPc: number,
): Map<string, JamMark> {
  const chord = new Set(chordPcs(rootPc))
  const scale = new Set(BLUES.map((s) => pc(tonicPc + s)))
  const marks = new Map<string, JamMark>()
  for (const n of harp) {
    const p = pc(n.midi)
    if (chord.has(p)) marks.set(noteId(n), 'chord')
    else if (scale.has(p)) marks.set(noteId(n), 'scale')
  }
  return marks
}
