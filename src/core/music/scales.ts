export type ScaleId = 'major' | 'minorPentatonic' | 'blues'

export interface Scale {
  readonly id: ScaleId
  readonly name: string
  /** Semitones above the root, ascending, without the octave. */
  readonly steps: readonly number[]
}

export const SCALES: readonly Scale[] = [
  { id: 'major', name: 'Major', steps: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'minorPentatonic', name: 'Minor pentatonic', steps: [0, 3, 5, 7, 10] },
  { id: 'blues', name: 'Blues', steps: [0, 3, 5, 6, 7, 10] },
]

export function scaleById(id: ScaleId): Scale {
  const scale = SCALES.find((s) => s.id === id)
  if (!scale) throw new Error(`Unknown scale: ${id}`)
  return scale
}

/** The scale's notes from `rootMidi` up to and including the root an octave higher. */
export function scaleOctave(rootMidi: number, scale: Scale): number[] {
  return [...scale.steps.map((s) => rootMidi + s), rootMidi + 12]
}
