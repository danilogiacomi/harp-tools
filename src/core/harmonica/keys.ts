import type { Spelling } from '../music/noteNames'
import type { TuningId } from './tunings'

/** Lowest to highest: G–B harps are pitched below C, Db–F# above. */
export const HARP_KEYS = ['G', 'Ab', 'A', 'Bb', 'B', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'F#'] as const
export type HarpKey = (typeof HARP_KEYS)[number]

const OFFSETS: Record<HarpKey, number> = {
  G: -5,
  Ab: -4,
  A: -3,
  Bb: -2,
  B: -1,
  C: 0,
  Db: 1,
  D: 2,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
}

const FLAT_KEYS: ReadonlySet<HarpKey> = new Set<HarpKey>(['F', 'Bb', 'Eb', 'Ab', 'Db'])

/** Semitones between this key's harp and a C harp. */
export function keyOffset(key: HarpKey): number {
  return OFFSETS[key]
}

export function keySpelling(key: HarpKey): Spelling {
  return FLAT_KEYS.has(key) ? 'flat' : 'sharp'
}

/**
 * Spelling for a harp in `key` tuned to `tuning` (spec's flats/sharps rule). A natural-minor
 * harp is labelled by its blow key but is spelled like its relative major, three semitones up.
 */
export function harpSpelling(key: HarpKey, tuning: TuningId): Spelling {
  if (tuning !== 'naturalMinor') return keySpelling(key)
  return keySpelling(keyForPitchClass(keyOffset(key) + 3))
}

const mod12 = (n: number) => ((n % 12) + 12) % 12

/** The key whose harp is pitched on pitch class `pc` (0 = C); any integer is taken mod 12. */
export function keyForPitchClass(pc: number): HarpKey {
  const target = mod12(pc)
  const key = HARP_KEYS.find((k) => mod12(OFFSETS[k]) === target)
  if (!key) throw new Error(`no harp key for pitch class ${pc}`) // unreachable: offsets cover all 12
  return key
}
