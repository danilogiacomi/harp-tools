import { describe, expect, it } from 'vitest'
import { ECHO_LIMIT_MS, echoPoints, echoRoundConfig, pickTarget } from './echoNote'
import type { ListenRoundState } from './listenRound'

const MATCHER = { toleranceCents: 25, holdMs: 500 }
const state = (patch: Partial<ListenRoundState>): ListenRoundState => ({
  status: 'listening',
  progress: 0,
  cents: null,
  elapsedMs: 0,
  helpOffered: false,
  timeMs: null,
  stability: null,
  ...patch,
})

describe('pickTarget', () => {
  it('avoids repeating the previous note', () => {
    expect(pickTarget([60, 62, 64], () => 0, 60)).toBe(62)
    expect(pickTarget([60, 62, 64], () => 0, null)).toBe(60)
  })
  it('repeats when there is only one note', () => {
    expect(pickTarget([60], () => 0, 60)).toBe(60)
  })
})

describe('echoRoundConfig', () => {
  it('practice is untimed and offers help; scored has 8 s and no help', () => {
    expect(echoRoundConfig('practice', MATCHER, 440)).toEqual({
      matcher: MATCHER,
      a4: 440,
      limitMs: null,
      helpAfterMs: 3000,
    })
    expect(echoRoundConfig('scored', MATCHER, 442)).toEqual({
      matcher: MATCHER,
      a4: 442,
      limitMs: ECHO_LIMIT_MS,
      helpAfterMs: null,
    })
    expect(ECHO_LIMIT_MS).toBe(8000)
  })
})

describe('echoPoints', () => {
  it('rewards speed on a hit and gives nothing on a timeout', () => {
    expect(echoPoints(state({ status: 'hit', timeMs: 2000, stability: 1 }))).toBe(175)
    expect(echoPoints(state({ status: 'timeout', elapsedMs: 8000 }))).toBe(0)
  })
})
