import { describe, expect, it } from 'vitest'
import { TapTempo, clampBpm } from './tempo'

describe('clampBpm', () => {
  it('rounds and clamps to 30–250', () => {
    expect(clampBpm(10)).toBe(30)
    expect(clampBpm(300)).toBe(250)
    expect(clampBpm(99.6)).toBe(100)
  })
})

describe('TapTempo', () => {
  it('needs two taps before reporting', () => {
    const t = new TapTempo()
    expect(t.tap(0)).toBeNull()
    expect(t.tap(500)).toBe(120)
  })
  it('averages the last 4 taps', () => {
    const t = new TapTempo()
    // All five taps would average 550 ms (109 BPM); the last four average 500 ms.
    ;[0, 700, 1200, 1700].forEach((ms) => t.tap(ms))
    expect(t.tap(2200)).toBe(120)
  })
  it('starts over after a long pause', () => {
    const t = new TapTempo()
    t.tap(0)
    t.tap(500)
    expect(t.tap(5000)).toBeNull()
  })
  it('clamps extreme tapping', () => {
    const t = new TapTempo()
    t.tap(0)
    expect(t.tap(100)).toBe(250)
  })
})
