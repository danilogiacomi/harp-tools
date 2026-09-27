import { describe, expect, it } from 'vitest'
import { buildHarp, tabLabel, type HarpNote } from '../harmonica/harp'
import { midiToFreq } from '../music/pitch'
import {
  BEND_LIMIT_MS,
  bendDepth,
  bendPoints,
  bendRoundConfig,
  isBend,
  maxBendSteps,
  unbentNote,
} from './bendTrainer'
import type { ListenRoundState } from './listenRound'

const c = buildHarp('C')
const byTab = (tab: string): HarpNote => c.find((n) => tabLabel(n) === tab)!

describe('bend helpers', () => {
  it('recognises bends', () => {
    expect(isBend(byTab("-3''"))).toBe(true)
    expect(isBend(byTab("10'"))).toBe(true)
    expect(isBend(byTab('-3'))).toBe(false)
    expect(isBend(byTab('6o'))).toBe(false)
  })

  it('finds the unbent note on the same hole', () => {
    expect(tabLabel(unbentNote(c, byTab("-3''")))).toBe('-3')
    expect(tabLabel(unbentNote(c, byTab("10''")))).toBe('10')
  })

  it('knows how deep each hole bends', () => {
    expect(maxBendSteps(c, byTab("-3'"))).toBe(3)
    expect(maxBendSteps(c, byTab("-2'"))).toBe(2)
    expect(maxBendSteps(c, byTab("10'"))).toBe(2)
    expect(maxBendSteps(c, byTab("-1'"))).toBe(1)
  })

  it('measures the live pitch in semitones below the unbent note', () => {
    expect(bendDepth(midiToFreq(69.5), 71)).toBeCloseTo(1.5)
    expect(bendDepth(midiToFreq(71), 71)).toBeCloseTo(0)
    expect(bendDepth(midiToFreq(71, 442), 71, 442)).toBeCloseTo(0)
  })
})

describe('bend scoring', () => {
  const MATCHER = { toleranceCents: 25, holdMs: 500 }

  it('times scored rounds at 10 s without help', () => {
    expect(bendRoundConfig('scored', MATCHER, 440)).toEqual({
      matcher: MATCHER,
      a4: 440,
      limitMs: BEND_LIMIT_MS,
      helpAfterMs: null,
    })
    expect(bendRoundConfig('practice', MATCHER, 440).limitMs).toBeNull()
  })

  it('weights points by stability and speed', () => {
    const hit: ListenRoundState = {
      status: 'hit',
      progress: 1,
      cents: 0,
      elapsedMs: 5000,
      helpOffered: false,
      timeMs: 5000,
      stability: 0.6,
    }
    // accuracy 0.5 + 0.5 × 0.6 = 0.8; bonus 1 + (1 − 5000/10000) = 1.5
    expect(bendPoints(hit)).toBe(120)
    expect(bendPoints({ ...hit, status: 'timeout', timeMs: null, stability: null })).toBe(0)
  })
})
