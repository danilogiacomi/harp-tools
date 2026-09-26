import { describe, expect, it } from 'vitest'
import { HARP_KEYS, keyOffset, keySpelling } from './keys'

describe('harp keys', () => {
  it('lists all 12 keys from lowest to highest', () => {
    expect(HARP_KEYS).toEqual(['G', 'Ab', 'A', 'Bb', 'B', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'F#'])
  })
  it('pitches G–B below C and Db–F# above C', () => {
    expect(keyOffset('G')).toBe(-5)
    expect(keyOffset('B')).toBe(-1)
    expect(keyOffset('C')).toBe(0)
    expect(keyOffset('Db')).toBe(1)
    expect(keyOffset('F#')).toBe(6)
  })
  it('spells flat keys with flats and the rest with sharps', () => {
    for (const k of ['F', 'Bb', 'Eb', 'Ab', 'Db'] as const) expect(keySpelling(k)).toBe('flat')
    for (const k of ['C', 'G', 'D', 'A', 'E', 'B', 'F#'] as const)
      expect(keySpelling(k)).toBe('sharp')
  })
})
