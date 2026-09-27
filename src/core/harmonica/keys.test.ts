import { describe, expect, it } from 'vitest'
import { HARP_KEYS, harpSpelling, keyForPitchClass, keyOffset, keySpelling } from './keys'

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

describe('harpSpelling', () => {
  it('spells a natural-minor harp by its relative major', () => {
    // C natural minor's relative major is Eb major (flats).
    expect(harpSpelling('C', 'naturalMinor')).toBe('flat')
    // G natural minor's relative major is Bb major (flats).
    expect(harpSpelling('G', 'naturalMinor')).toBe('flat')
  })
  it('matches keySpelling for every other tuning, for every key', () => {
    for (const tuning of ['richter', 'paddy', 'country'] as const) {
      for (const key of HARP_KEYS) expect(harpSpelling(key, tuning)).toBe(keySpelling(key))
    }
  })
})

describe('keyForPitchClass', () => {
  it('finds the harp key for each pitch class, wrapping any integer', () => {
    expect(keyForPitchClass(0)).toBe('C')
    expect(keyForPitchClass(7)).toBe('G')
    expect(keyForPitchClass(1)).toBe('Db')
    expect(keyForPitchClass(6)).toBe('F#')
    expect(keyForPitchClass(10)).toBe('Bb')
    expect(keyForPitchClass(-5)).toBe('G')
    expect(keyForPitchClass(19)).toBe('G')
  })
})
