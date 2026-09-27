import { describe, expect, it } from 'vitest'
import { SCALES, scaleById, scaleOctave } from './scales'

describe('SCALES', () => {
  it('defines the three v1 scales as semitone patterns', () => {
    expect(SCALES.map((s) => s.id)).toEqual(['major', 'minorPentatonic', 'blues'])
    expect(scaleById('major').steps).toEqual([0, 2, 4, 5, 7, 9, 11])
    expect(scaleById('minorPentatonic').steps).toEqual([0, 3, 5, 7, 10])
    expect(scaleById('blues').steps).toEqual([0, 3, 5, 6, 7, 10])
  })
})

describe('scaleOctave', () => {
  it('spans root to root inclusive', () => {
    expect(scaleOctave(60, scaleById('major'))).toEqual([60, 62, 64, 65, 67, 69, 71, 72])
    expect(scaleOctave(67, scaleById('blues'))).toEqual([67, 70, 72, 73, 74, 77, 79])
    expect(scaleOctave(62, scaleById('minorPentatonic'))).toEqual([62, 65, 67, 69, 72, 74])
  })
})
