import { describe, expect, it } from 'vitest'
import { scaleById } from '../music/scales'
import { buildHarp, tabLabel, type HarpNote } from './harp'
import { HARP_KEYS } from './keys'
import {
  POSITION_INFO,
  easiestOctave,
  harpForPosition,
  pickNote,
  positionLabel,
  positionRootPc,
  positionTonicPc,
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

describe('positionTonicPc', () => {
  it('moves up a fifth per position, through 12th', () => {
    expect([1, 2, 3, 4, 5, 12].map((p) => positionTonicPc('C', p))).toEqual([0, 7, 2, 9, 4, 5])
    expect(positionTonicPc('G', 2)).toBe(2)
    expect(positionTonicPc('F#', 12)).toBe(11)
  })
  it('agrees with positionRootPc for 1st–3rd', () => {
    for (const key of HARP_KEYS)
      for (const p of [1, 2, 3] as const)
        expect(positionRootPc(key, p)).toBe(positionTonicPc(key, p))
  })
})

describe('harpForPosition', () => {
  it('round-trips every key and listed position', () => {
    for (const key of HARP_KEYS) {
      for (const { position } of POSITION_INFO) {
        expect(harpForPosition(positionTonicPc(key, position), position)).toBe(key)
      }
    }
  })
  it('knows the classic choices', () => {
    expect(harpForPosition(7, 2)).toBe('C') // G blues → C harp
    expect(harpForPosition(9, 3)).toBe('G') // A minor in 3rd → G harp
    expect(harpForPosition(0, 1)).toBe('C') // C major in 1st → C harp
    expect(harpForPosition(9, 4)).toBe('C') // A natural minor in 4th → C harp
  })
})

describe('POSITION_INFO', () => {
  it('gives the mode and typical use of 1st–5th and 12th', () => {
    expect(POSITION_INFO.map((i) => [i.position, i.mode, i.use, i.short])).toEqual([
      [1, 'Ionian', 'major, folk', 'major'],
      [2, 'Mixolydian', 'blues, rock, country', 'blues'],
      [3, 'Dorian', 'minor blues', 'minor'],
      [4, 'Aeolian', 'natural minor', 'minor'],
      [5, 'Phrygian', null, 'Phrygian'],
      [12, 'Lydian', null, 'Lydian'],
    ])
  })
})

describe('positionLabel', () => {
  it('writes English ordinals', () => {
    expect([1, 2, 3, 4, 5, 11, 12].map(positionLabel)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '5th',
      '11th',
      '12th',
    ])
  })
})
