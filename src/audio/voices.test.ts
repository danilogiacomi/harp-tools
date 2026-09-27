import { describe, expect, it } from 'vitest'
import { REED_PARTIALS, reedFrequencies } from './voices'

describe('reed voice', () => {
  it('uses partials 1–5 at the spec amplitudes', () => {
    expect(REED_PARTIALS).toEqual([
      { multiple: 1, gain: 1 },
      { multiple: 2, gain: 0.55 },
      { multiple: 3, gain: 0.35 },
      { multiple: 4, gain: 0.2 },
      { multiple: 5, gain: 0.12 },
    ])
  })
  it('keeps the fundamental exact and the overtones at exact multiples', () => {
    expect(reedFrequencies(440)).toEqual([440, 880, 1320, 1760, 2200])
    expect(reedFrequencies(261.6255653005986)[0]).toBe(261.6255653005986)
  })
})
