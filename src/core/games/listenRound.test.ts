import { describe, expect, it } from 'vitest'
import { midiToFreq } from '../music/pitch'
import { ListenRound, type ListenRoundConfig } from './listenRound'

const CONFIG: ListenRoundConfig = {
  matcher: { toleranceCents: 25, holdMs: 500 },
  a4: 440,
  limitMs: 8000,
  helpAfterMs: 3000,
}
const C4 = midiToFreq(60)
const D4 = midiToFreq(62)
const round = (config: Partial<ListenRoundConfig> = {}) =>
  new ListenRound(60, { ...CONFIG, ...config }, 1000)

describe('ListenRound', () => {
  it('is hit once the target is held, timed from the round start', () => {
    const r = round()
    for (let t = 1000; t < 1500; t += 50) expect(r.push(C4, t).status).toBe('listening')
    expect(r.push(C4, 1500)).toMatchObject({ status: 'hit', timeMs: 500, stability: 1 })
  })

  it('times out at the limit', () => {
    const r = round()
    for (let t = 1000; t < 9000; t += 100) expect(r.push(null, t).status).toBe('listening')
    expect(r.push(null, 9000)).toMatchObject({ status: 'timeout', timeMs: null, elapsedMs: 8000 })
  })

  it('never times out without a limit', () => {
    expect(round({ limitMs: null }).push(null, 1_000_000).status).toBe('listening')
  })

  it('offers help after 3 s of wrong notes', () => {
    const r = round()
    for (let t = 1000; t <= 3950; t += 50) expect(r.push(D4, t).helpOffered).toBe(false)
    expect(r.push(D4, 4000).helpOffered).toBe(true)
    expect(r.push(null, 4050).helpOffered).toBe(true) // stays offered
  })

  it('does not count silence as a wrong attempt', () => {
    const r = round()
    for (let t = 1000; t <= 6000; t += 50) r.push(null, t)
    expect(r.state.helpOffered).toBe(false)
  })

  it('counts a long gap between readings as at most 100 ms', () => {
    const r = round()
    r.push(D4, 1000)
    expect(r.push(D4, 5000).helpOffered).toBe(false)
  })

  it('never offers help when helpAfterMs is null', () => {
    const r = round({ helpAfterMs: null })
    for (let t = 1000; t <= 6000; t += 50) r.push(D4, t)
    expect(r.state.helpOffered).toBe(false)
  })

  it('ignores readings after the round is over', () => {
    const r = round()
    r.push(C4, 1000)
    const hit = r.push(C4, 1500)
    expect(r.push(null, 20000)).toBe(hit)
  })
})
