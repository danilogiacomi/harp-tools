import { describe, expect, it } from 'vitest'
import { holeFinderRoundConfig } from './holeFinder'

const matcher = { toleranceCents: 25, holdMs: 500 }

describe('holeFinderRoundConfig', () => {
  it('is untimed and offers no automatic help in practice', () => {
    expect(holeFinderRoundConfig('practice', matcher, 440)).toEqual({
      matcher,
      a4: 440,
      limitMs: null,
      helpAfterMs: null,
    })
  })
  it('gives 8 s per note in scored mode', () => {
    expect(holeFinderRoundConfig('scored', matcher, 442)).toEqual({
      matcher,
      a4: 442,
      limitMs: 8000,
      helpAfterMs: null,
    })
  })
})
