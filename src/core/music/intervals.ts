export type IntervalId =
  'm2' | 'M2' | 'm3' | 'M3' | 'P4' | 'TT' | 'P5' | 'm6' | 'M6' | 'm7' | 'M7' | 'P8'

export interface Interval {
  readonly id: IntervalId
  readonly name: string
  readonly semitones: number
}

/** Minor 2nd to octave, in ascending size (index = semitones − 1). */
export const INTERVALS: readonly Interval[] = [
  { id: 'm2', name: 'Minor 2nd', semitones: 1 },
  { id: 'M2', name: 'Major 2nd', semitones: 2 },
  { id: 'm3', name: 'Minor 3rd', semitones: 3 },
  { id: 'M3', name: 'Major 3rd', semitones: 4 },
  { id: 'P4', name: 'Perfect 4th', semitones: 5 },
  { id: 'TT', name: 'Tritone', semitones: 6 },
  { id: 'P5', name: 'Perfect 5th', semitones: 7 },
  { id: 'm6', name: 'Minor 6th', semitones: 8 },
  { id: 'M6', name: 'Major 6th', semitones: 9 },
  { id: 'm7', name: 'Minor 7th', semitones: 10 },
  { id: 'M7', name: 'Major 7th', semitones: 11 },
  { id: 'P8', name: 'Octave', semitones: 12 },
]

export function intervalBySemitones(semitones: number): Interval | null {
  return INTERVALS[semitones - 1] ?? null
}

export function intervalBetween(a: number, b: number): Interval | null {
  return intervalBySemitones(Math.abs(b - a))
}
