import { describe, expect, it } from 'vitest'
import { buildHarp } from './harp'
import { diagramLayout } from './layout'

const c = buildHarp('C')
const midis = (cells: ({ midi: number } | null)[]) => cells.map((n) => n?.midi ?? null)

describe('diagramLayout', () => {
  it('stacks rows outward from the hole numbers, deepest bends furthest out', () => {
    const { above, below } = diagramLayout(c, false)
    expect(above.map((r) => r.id)).toEqual(['overblow', 'blowBend-2', 'blowBend-1', 'blow'])
    expect(below.map((r) => r.id)).toEqual([
      'draw',
      'drawBend-1',
      'drawBend-2',
      'drawBend-3',
      'overdraw',
    ])
  })

  it('always has 10 cells per row, aligned by hole', () => {
    const { above, below } = diagramLayout(c, true)
    for (const row of [...above, ...below]) expect(row.cells).toHaveLength(10)
    const blowBend2 = above.find((r) => r.id === 'blowBend-2')!
    expect(midis(blowBend2.cells)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      94,
    ])
    const drawBend3 = below.find((r) => r.id === 'drawBend-3')!
    expect(midis(drawBend3.cells)).toEqual([
      null,
      null,
      68,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ])
  })

  it('hides advanced over-notes unless requested', () => {
    const hidden = diagramLayout(c, false).above[0]
    expect(midis(hidden.cells)).toEqual([63, null, null, 75, 78, 82, null, null, null, null])
    const shown = diagramLayout(c, true).above[0]
    expect(midis(shown.cells)).toEqual([63, 68, 72, 75, 78, 82, null, null, null, null])
    const overdraw = diagramLayout(c, false).below.at(-1)!
    expect(midis(overdraw.cells)).toEqual([null, null, null, null, null, null, 85, null, 92, 97])
  })

  it('labels rows for display', () => {
    const { above, below } = diagramLayout(c, false)
    expect(above.map((r) => r.label)).toEqual(['Overblow', "Blow bend ''", "Blow bend '", 'Blow'])
    expect(below.map((r) => r.label)).toEqual([
      'Draw',
      "Draw bend '",
      "Draw bend ''",
      "Draw bend '''",
      'Overdraw',
    ])
  })
})
