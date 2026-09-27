import { describe, expect, it } from 'vitest'
import {
  buildHarp,
  describeNote,
  findNotes,
  harpFromReeds,
  noteId,
  tabLabel,
  type HarpNote,
  type Technique,
} from './harp'
import { HARP_KEYS } from './keys'
import { diagramLayout } from './layout'
import { TUNING_IDS } from './tunings'

const c = buildHarp('C')
const get = (harp: HarpNote[], hole: number, technique: Technique, bendSteps = 0) => {
  const n = harp.find(
    (x) => x.hole === hole && x.technique === technique && x.bendSteps === bendSteps,
  )
  if (!n) throw new Error(`missing ${hole} ${technique} ${bendSteps}`)
  return n
}

describe('buildHarp — C Richter', () => {
  it('has the standard blow and draw notes', () => {
    const blow = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((h) => get(c, h, 'blow').midi)
    const draw = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((h) => get(c, h, 'draw').midi)
    expect(blow).toEqual([60, 64, 67, 72, 76, 79, 84, 88, 91, 96])
    expect(draw).toEqual([62, 67, 71, 74, 77, 81, 83, 86, 89, 93])
  })

  it('derives draw bends on holes 1, 2, 3, 4, 6', () => {
    const bends = c.filter((n) => n.technique === 'drawBend')
    expect(bends.map((n) => [n.hole, n.bendSteps, n.midi])).toEqual([
      [1, 1, 61],
      [2, 1, 66],
      [2, 2, 65],
      [3, 1, 70],
      [3, 2, 69],
      [3, 3, 68],
      [4, 1, 73],
      [6, 1, 80],
    ])
  })

  it('derives blow bends on holes 8, 9, 10', () => {
    const bends = c.filter((n) => n.technique === 'blowBend')
    expect(bends.map((n) => [n.hole, n.bendSteps, n.midi])).toEqual([
      [8, 1, 87],
      [9, 1, 90],
      [10, 1, 95],
      [10, 2, 94],
    ])
  })

  it('puts overblows a semitone above the draw note on holes 1–6', () => {
    const ob = c.filter((n) => n.technique === 'overblow')
    expect(ob.map((n) => [n.hole, n.midi, n.common])).toEqual([
      [1, 63, true],
      [2, 68, false],
      [3, 72, false],
      [4, 75, true],
      [5, 78, true],
      [6, 82, true],
    ])
  })

  it('puts overdraws a semitone above the blow note on holes 7–10', () => {
    const od = c.filter((n) => n.technique === 'overdraw')
    expect(od.map((n) => [n.hole, n.midi, n.common])).toEqual([
      [7, 85, true],
      [8, 89, false],
      [9, 92, true],
      [10, 97, true],
    ])
  })

  it('has no bends on holes 5 and 7', () => {
    expect(c.filter((n) => (n.hole === 5 || n.hole === 7) && n.bendSteps > 0)).toEqual([])
  })

  it('has 42 notes in total', () => {
    expect(c).toHaveLength(42)
  })
})

describe('buildHarp — other keys', () => {
  it('transposes every key by its offset', () => {
    expect(get(buildHarp('G'), 1, 'blow').midi).toBe(55)
    expect(get(buildHarp('A'), 1, 'blow').midi).toBe(57)
    expect(get(buildHarp('D'), 4, 'draw').midi).toBe(76)
    expect(get(buildHarp('F#'), 10, 'overdraw').midi).toBe(103)
  })
  it('keeps the same 42-note shape in every key', () => {
    for (const key of HARP_KEYS) expect(buildHarp(key)).toHaveLength(42)
  })
})

describe('findNotes', () => {
  it('returns every hole that produces a pitch', () => {
    const g4 = findNotes(c, 67).map(tabLabel)
    expect(g4.sort()).toEqual(['-2', '3'])
  })
  it('returns [] for pitches not on the harp', () => {
    expect(findNotes(c, 59)).toEqual([])
  })
})

describe('tabLabel', () => {
  it('uses standard tab notation', () => {
    expect(tabLabel(get(c, 4, 'blow'))).toBe('4')
    expect(tabLabel(get(c, 4, 'draw'))).toBe('-4')
    expect(tabLabel(get(c, 3, 'drawBend', 2))).toBe("-3''")
    expect(tabLabel(get(c, 10, 'blowBend', 2))).toBe("10''")
    expect(tabLabel(get(c, 6, 'overblow'))).toBe('6o')
    expect(tabLabel(get(c, 7, 'overdraw'))).toBe('7od')
  })
})

describe('describeNote', () => {
  it('says which hole and how to play it', () => {
    expect(describeNote(get(c, 4, 'blow'))).toBe('Hole 4 · blow (4)')
    expect(describeNote(get(c, 2, 'draw'))).toBe('Hole 2 · draw (-2)')
    expect(describeNote(get(c, 3, 'drawBend', 1))).toBe("Hole 3 · draw, bent a half step (-3')")
    expect(describeNote(get(c, 3, 'drawBend', 3))).toBe(
      "Hole 3 · draw, bent a step and a half (-3''')",
    )
    expect(describeNote(get(c, 10, 'blowBend', 2))).toBe("Hole 10 · blow, bent a whole step (10'')")
    expect(describeNote(get(c, 6, 'overblow'))).toBe('Hole 6 · overblow (6o)')
    expect(describeNote(get(c, 7, 'overdraw'))).toBe('Hole 7 · overdraw (7od)')
  })
})

describe('noteId', () => {
  it('is unique within a harp and the same across keys', () => {
    const ids = c.map(noteId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(buildHarp('A').map(noteId)).toEqual(ids)
  })
})

const bendsOf = (harp: HarpNote[], technique: Technique) =>
  harp.filter((n) => n.technique === technique).map((n) => [n.hole, n.bendSteps, n.midi])
const oversOf = (harp: HarpNote[], technique: Technique) =>
  harp.filter((n) => n.technique === technique).map((n) => [n.hole, n.midi, n.common])
const row = (harp: HarpNote[], technique: Technique) =>
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((h) => get(harp, h, technique).midi)

describe('buildHarp — tunings', () => {
  it('defaults to Richter, and Richter is unchanged', () => {
    expect(buildHarp('C', 'richter')).toEqual(buildHarp('C'))
    expect(buildHarp('G', 'richter')).toEqual(buildHarp('G'))
  })

  it('Paddy: hole 3 blow A4 against draw B4 gives one draw bend (Bb4) and overblow C5', () => {
    const p = buildHarp('C', 'paddy')
    expect(row(p, 'blow')).toEqual([60, 64, 69, 72, 76, 79, 84, 88, 91, 96])
    expect(p.filter((n) => n.hole === 3 && n.technique === 'drawBend').map((n) => n.midi)).toEqual([
      70,
    ])
    expect(get(p, 3, 'overblow')).toMatchObject({ midi: 72, common: false })
    expect(p).toHaveLength(40)
  })

  it('Country: hole 5 draw is F#5, with one draw bend (F5) and a common overblow', () => {
    const c = buildHarp('C', 'country')
    expect(row(c, 'draw')).toEqual([62, 67, 71, 74, 78, 81, 83, 86, 89, 93])
    expect(c.filter((n) => n.hole === 5 && n.technique === 'drawBend').map((n) => n.midi)).toEqual([
      77,
    ])
    expect(get(c, 5, 'overblow')).toMatchObject({ midi: 79, common: true })
    expect(c).toHaveLength(43)
  })

  it('Natural minor: hole 3 draw is Bb4 with two bends (A4, Ab4); all bends and over-notes', () => {
    const m = buildHarp('C', 'naturalMinor')
    expect(row(m, 'blow')).toEqual([60, 63, 67, 72, 75, 79, 84, 87, 91, 96])
    expect(row(m, 'draw')).toEqual([62, 67, 70, 74, 77, 80, 82, 86, 89, 92])
    expect(bendsOf(m, 'drawBend')).toEqual([
      [1, 1, 61],
      [2, 1, 66],
      [2, 2, 65],
      [2, 3, 64],
      [3, 1, 69],
      [3, 2, 68],
      [4, 1, 73],
      [5, 1, 76],
    ])
    expect(bendsOf(m, 'blowBend')).toEqual([
      [7, 1, 83],
      [9, 1, 90],
      [10, 1, 95],
      [10, 2, 94],
      [10, 3, 93],
    ])
    expect(oversOf(m, 'overblow')).toEqual([
      [1, 63, true],
      [2, 68, false],
      [3, 71, false],
      [4, 75, true],
      [5, 78, true],
      [6, 81, true],
    ])
    expect(oversOf(m, 'overdraw')).toEqual([
      [7, 85, true],
      [8, 88, false],
      [9, 92, true],
      [10, 97, true],
    ])
    expect(m).toHaveLength(43)
  })

  it('describes a three-step blow bend', () => {
    expect(describeNote(get(buildHarp('C', 'naturalMinor'), 10, 'blowBend', 3))).toBe(
      "Hole 10 · blow, bent a step and a half (10''')",
    )
  })

  it('lays out three blow-bend and three draw-bend rows for natural minor', () => {
    const layout = diagramLayout(buildHarp('C', 'naturalMinor'), false)
    expect(layout.above.map((r) => r.id)).toEqual([
      'overblow',
      'blowBend-3',
      'blowBend-2',
      'blowBend-1',
      'blow',
    ])
    expect(layout.below.map((r) => r.id)).toEqual([
      'draw',
      'drawBend-1',
      'drawBend-2',
      'drawBend-3',
      'overdraw',
    ])
  })

  it('transposes every tuning by the key, keeping ids unique', () => {
    expect(get(buildHarp('G', 'country'), 5, 'draw').midi).toBe(73)
    expect(get(buildHarp('A', 'paddy'), 3, 'blow').midi).toBe(66)
    for (const tuning of TUNING_IDS) {
      const c = buildHarp('C', tuning)
      const ids = c.map(noteId)
      expect(new Set(ids).size).toBe(ids.length)
      for (const key of HARP_KEYS) expect(buildHarp(key, tuning).map(noteId)).toEqual(ids)
    }
  })

  it('gives equal reeds no bends and no over-note', () => {
    const blow = [60, 64, 67, 72, 76, 79, 84, 88, 91, 96]
    const draw = [60, 67, 71, 74, 77, 81, 83, 86, 89, 93]
    const harp = harpFromReeds(blow, draw, 0)
    expect(harp.filter((n) => n.hole === 1).map((n) => [n.technique, n.midi])).toEqual([
      ['blow', 60],
      ['draw', 60],
    ])
  })
})
