import type { Spelling } from '../music/noteNames'

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
