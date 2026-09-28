import { describe, expect, it } from 'vitest'
import { BeatAnchor } from './beatAnchor'

describe('BeatAnchor', () => {
  it('knows nothing before the first beat', () => {
    const a = new BeatAnchor(500)
    expect(a.originMs).toBeNull()
    expect(a.beatTime(3)).toBeNull()
  })

  it('puts beat 0 on the first heard beat and extrapolates the grid', () => {
    const a = new BeatAnchor(500)
    a.sync(1000)
    expect(a.beatTime(0)).toBe(1000)
    expect(a.beatTime(4.5)).toBe(3250)
  })

  it('fits the grid to the median of recent beats, so one late timer does not move it', () => {
    const a = new BeatAnchor(500)
    ;[1004, 1502, 2030, 2503, 3001].forEach((t) => a.sync(t))
    // origins 1004, 1002, 1030, 1003, 1001 → median 1003
    expect(a.originMs).toBe(1003)
  })

  it('ignores the same beat reported twice', () => {
    const a = new BeatAnchor(500)
    a.sync(1000)
    a.sync(1000)
    a.sync(1510)
    expect(a.originMs).toBe(1005)
  })
})
