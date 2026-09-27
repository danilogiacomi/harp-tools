export type Spelling = 'sharp' | 'flat'

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

export function noteName(midi: number, spelling: Spelling = 'sharp'): string {
  const pitchClass = ((midi % 12) + 12) % 12
  const octave = Math.floor(midi / 12) - 1
  return (spelling === 'flat' ? FLAT_NAMES : SHARP_NAMES)[pitchClass] + octave
}

/** A pitch class name without octave, e.g. 1 → 'C#' or 'Db'. */
export function pitchClassName(pc: number, spelling: Spelling = 'sharp'): string {
  const i = ((pc % 12) + 12) % 12
  return (spelling === 'flat' ? FLAT_NAMES : SHARP_NAMES)[i]
}
