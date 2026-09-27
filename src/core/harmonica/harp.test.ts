import { describe, expect, it } from 'vitest'
import {
  buildHarp,
  describeNote,
  findNotes,
  noteId,
  tabLabel,
  type HarpNote,
  type Technique,
} from './harp'
import { HARP_KEYS } from './keys'

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
