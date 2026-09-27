import { describe, expect, it } from 'vitest'
import { TUNINGS, TUNING_IDS, tuningById } from './tunings'

describe('TUNINGS', () => {
  it('lists the four tunings in order, with names and descriptions', () => {
    expect(TUNING_IDS).toEqual(['richter', 'paddy', 'country', 'naturalMinor'])
    expect(TUNINGS.map((t) => t.name)).toEqual([
      'Richter',
      'Paddy Richter',
      'Country',
      'Natural minor',
    ])
    for (const t of TUNINGS) {
      expect(t.description.length).toBeGreaterThan(10)
      expect(t.blow).toHaveLength(10)
      expect(t.draw).toHaveLength(10)
    }
  })

  it('pins each tuning table for a C harp', () => {
    expect(tuningById('richter').blow).toEqual([60, 64, 67, 72, 76, 79, 84, 88, 91, 96])
    expect(tuningById('richter').draw).toEqual([62, 67, 71, 74, 77, 81, 83, 86, 89, 93])
    expect(tuningById('paddy').blow).toEqual([60, 64, 69, 72, 76, 79, 84, 88, 91, 96])
    expect(tuningById('paddy').draw).toEqual([62, 67, 71, 74, 77, 81, 83, 86, 89, 93])
    expect(tuningById('country').blow).toEqual([60, 64, 67, 72, 76, 79, 84, 88, 91, 96])
    expect(tuningById('country').draw).toEqual([62, 67, 71, 74, 78, 81, 83, 86, 89, 93])
    expect(tuningById('naturalMinor').blow).toEqual([60, 63, 67, 72, 75, 79, 84, 87, 91, 96])
    expect(tuningById('naturalMinor').draw).toEqual([62, 67, 70, 74, 77, 80, 82, 86, 89, 92])
  })
})
