import { describe, expect, it } from 'vitest'
import { scaleById } from '../music/scales'
import { buildHarp, tabLabel, type HarpNote } from './harp'
import { HARP_KEYS } from './keys'
import {
  easiestOctave,
  pickNote,
  positionRootPc,
  runSequence,
  scaleOctaves,
  type PathOptions,
} from './positions'

const c = buildHarp('C')
const PLAIN: PathOptions = { includeOver: false, showAdvanced: false }
const OVER: PathOptions = { includeOver: true, showAdvanced: false }
const tabs = (octaves: HarpNote[][]) => octaves.map((o) => o.map(tabLabel))

describe('positionRootPc', () => {
  it('moves up a fifth per position', () => {
    expect(positionRootPc('C', 1)).toBe(0) // C
    expect(positionRootPc('C', 2)).toBe(7) // G
    expect(positionRootPc('C', 3)).toBe(2) // D
    expect(positionRootPc('G', 2)).toBe(2) // D
    expect(positionRootPc('F', 2)).toBe(0) // C
    expect(positionRootPc('F#', 3)).toBe(8) // G#
  })
})

describe('pickNote', () => {
  it('prefers plain notes, then the lower hole', () => {
    expect(tabLabel(pickNote(c, 67, PLAIN)!)).toBe('-2') // not 3 blow
  })
  it('prefers a plain note over an advanced overblow at the same pitch', () => {
    expect(tabLabel(pickNote(c, 72, { includeOver: true, showAdvanced: true })!)).toBe('4') // not 3o
  })
  it('uses bends when nothing plain exists', () => {
    expect(tabLabel(pickNote(c, 70, PLAIN)!)).toBe("-3'")
  })
  it('only uses over-notes when allowed', () => {
    expect(pickNote(c, 82, PLAIN)).toBeNull()
    expect(tabLabel(pickNote(c, 82, OVER)!)).toBe('6o')
  })
  it('hides advanced over-notes unless showAdvanced', () => {
    // Ab4 on a C harp: -3''' (a bend) wins anyway; G#4 via 2o is advanced.
    expect(tabLabel(pickNote(c, 68, OVER)!)).toBe("-3'''")
    expect(pickNote(c, 100, OVER)).toBeNull()
  })
})

describe('scaleOctaves — C harp', () => {
  it('1st position major: three octaves, bends where needed', () => {
    expect(tabs(scaleOctaves(c, 'C', scaleById('major'), 1, PLAIN))).toEqual([
      ['1', '-1', '2', "-2''", '-2', "-3''", '-3', '4'],
      ['4', '-4', '5', '-5', '6', '-6', '-7', '7'],
      ['7', '-8', '8', '-9', '9', '-10', "10'", '10'],
    ])
  })

  it('2nd position blues without over-notes: the low octave only', () => {
    expect(tabs(scaleOctaves(c, 'C', scaleById('blues'), 2, PLAIN))).toEqual([
      ['-2', "-3'", '4', "-4'", '-4', '-5', '6'],
    ])
  })

  it('2nd position blues with over-notes adds the middle octave', () => {
    expect(tabs(scaleOctaves(c, 'C', scaleById('blues'), 2, OVER))).toEqual([
      ['-2', "-3'", '4', "-4'", '-4', '-5', '6'],
      ['6', '6o', '7', '7od', '-8', '-9', '9'],
    ])
  })

  it('3rd position minor pentatonic', () => {
    expect(tabs(scaleOctaves(c, 'C', scaleById('minorPentatonic'), 3, PLAIN))).toEqual([
      ['-1', "-2''", '-2', "-3''", '4', '-4'],
      ['-4', '-5', '6', '-6', '7', '-8'],
    ])
  })

  it('1st position blues without over-notes: only the top octave is playable', () => {
    expect(tabs(scaleOctaves(c, 'C', scaleById('blues'), 1, PLAIN))).toEqual([
      ['7', "8'", '-9', "9'", '9', "10''", '10'],
    ])
  })

  it('returns no octaves when nothing is playable', () => {
    const plainOnly = c.filter((n) => n.technique === 'blow' || n.technique === 'draw')
    expect(scaleOctaves(plainOnly, 'C', scaleById('blues'), 2, OVER)).toEqual([])
  })
})

describe('scaleOctaves — every key', () => {
  it.each(HARP_KEYS)('%s harp uses the same holes as a C harp', (key) => {
    const harp = buildHarp(key)
    for (const scale of ['major', 'minorPentatonic', 'blues'] as const) {
      for (const position of [1, 2, 3] as const) {
        expect(tabs(scaleOctaves(harp, key, scaleById(scale), position, OVER))).toEqual(
          tabs(scaleOctaves(c, 'C', scaleById(scale), position, OVER)),
        )
      }
    }
  })
})

describe('easiestOctave', () => {
  it('picks the octave with the fewest bends and over-notes, lowest on ties', () => {
    expect(easiestOctave(scaleOctaves(c, 'C', scaleById('major'), 1, PLAIN))).toBe(1)
    expect(easiestOctave(scaleOctaves(c, 'C', scaleById('blues'), 2, OVER))).toBe(0)
    expect(easiestOctave([])).toBe(0)
  })
})

describe('runSequence', () => {
  it('runs up, down, or up and back without repeating the top note', () => {
    expect(runSequence([1, 2, 3], 'up')).toEqual([1, 2, 3])
    expect(runSequence([1, 2, 3], 'down')).toEqual([3, 2, 1])
    expect(runSequence([1, 2, 3], 'upDown')).toEqual([1, 2, 3, 2, 1])
  })
})
