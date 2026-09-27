import { describe, expect, it } from 'vitest'
import { INTERVALS, intervalBetween, intervalBySemitones } from './intervals'

describe('INTERVALS', () => {
  it('lists minor 2nd to octave as 1–12 semitones', () => {
    expect(INTERVALS.map((i) => i.id)).toEqual([
      'm2',
      'M2',
      'm3',
      'M3',
      'P4',
      'TT',
      'P5',
      'm6',
      'M6',
      'm7',
      'M7',
      'P8',
    ])
    expect(INTERVALS.map((i) => i.semitones)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(INTERVALS[0].name).toBe('Minor 2nd')
    expect(INTERVALS[5].name).toBe('Tritone')
    expect(INTERVALS[11].name).toBe('Octave')
  })
})

describe('intervalBySemitones', () => {
  it('finds intervals inside the octave only', () => {
    expect(intervalBySemitones(7)?.id).toBe('P5')
    expect(intervalBySemitones(0)).toBeNull()
    expect(intervalBySemitones(13)).toBeNull()
  })
})

describe('intervalBetween', () => {
  it('measures the distance in either direction', () => {
    expect(intervalBetween(60, 67)?.id).toBe('P5')
    expect(intervalBetween(67, 60)?.id).toBe('P5')
    expect(intervalBetween(60, 61)?.id).toBe('m2')
  })
  it('returns null for unisons and compound intervals', () => {
    expect(intervalBetween(60, 60)).toBeNull()
    expect(intervalBetween(60, 73)).toBeNull()
  })
})
