import { describe, expect, it } from 'vitest'
import { ToneHistory, tracePath } from './history'

describe('ToneHistory', () => {
  it('keeps the last six seconds', () => {
    const h = new ToneHistory()
    for (let t = 0; t <= 8000; t += 1000) h.push({ tMs: t, cents: 0, db: -20 })
    expect(h.points.map((p) => p.tMs)).toEqual([2000, 3000, 4000, 5000, 6000, 7000, 8000])
  })
})

describe('tracePath', () => {
  const box = { nowMs: 6000, windowMs: 6000, width: 600, height: 100, range: [-50, 50] as const }

  it('maps time to x and value to y, newest on the right', () => {
    const points = [
      { tMs: 0, cents: -50, db: null },
      { tMs: 3000, cents: 0, db: null },
      { tMs: 6000, cents: 25, db: null },
    ]
    expect(tracePath(points, 'cents', box)).toBe('M0.0 100.0 L300.0 50.0 L600.0 25.0')
  })

  it('breaks the line at silence and clamps out-of-range values', () => {
    const points = [
      { tMs: 1000, cents: 80, db: null },
      { tMs: 2000, cents: null, db: null },
      { tMs: 3000, cents: -10, db: null },
      { tMs: 4000, cents: -10, db: null },
    ]
    expect(tracePath(points, 'cents', box)).toBe('M100.0 0.0 M300.0 60.0 L400.0 60.0')
  })

  it('draws the level series on its own range', () => {
    const points = [{ tMs: 6000, cents: null, db: -30 }]
    expect(tracePath(points, 'db', { ...box, range: [-60, 0] })).toBe('M600.0 50.0')
  })
})
