import { describe, expect, it } from 'vitest'
import { buildHarp, noteId, tabLabel } from '../harmonica/harp'
import { positionTonicPc } from '../harmonica/positions'
import { bluesForm, chordName, chordPcs, chordRootPc, jamMarks } from './blues'

describe('bluesForm', () => {
  it('is a 12-bar I–IV–V with the I–V turnaround', () => {
    expect(bluesForm(false).join(' ')).toBe('I I I I IV IV I I V IV I V')
  })

  it('moves to IV in bar 2 with the quick change', () => {
    expect(bluesForm(true).join(' ')).toBe('I IV I I IV IV I I V IV I V')
  })
})

describe('chords', () => {
  const g = positionTonicPc('C', 2)

  it('plays G blues on a C harp in 2nd position: G7, C7, D7', () => {
    expect(g).toBe(7)
    expect((['I', 'IV', 'V'] as const).map((d) => chordName(chordRootPc(g, d), 'sharp'))).toEqual([
      'G7',
      'C7',
      'D7',
    ])
  })

  it('spells chords in the harp key’s spelling', () => {
    const f = positionTonicPc('Bb', 2) // F blues on a Bb harp
    expect((['I', 'IV', 'V'] as const).map((d) => chordName(chordRootPc(f, d), 'flat'))).toEqual([
      'F7',
      'Bb7',
      'C7',
    ])
  })

  it('builds dominant 7ths', () => {
    expect(chordPcs(7)).toEqual([7, 11, 2, 5]) // G B D F
  })

  it('follows the position: 1st and 3rd on a C harp are C and D', () => {
    expect(chordName(chordRootPc(positionTonicPc('C', 1), 'I'), 'sharp')).toBe('C7')
    expect(chordName(chordRootPc(positionTonicPc('C', 3), 'V'), 'sharp')).toBe('A7')
  })
})

describe('jamMarks', () => {
  const harp = buildHarp('C')
  const markOf = (marks: Map<string, string>) => (tab: string) =>
    marks.get(noteId(harp.find((n) => tabLabel(n) === tab)!)) ?? null

  it('marks the chord tones and the rest of the blues scale', () => {
    const of = markOf(jamMarks(harp, 7, 7)) // G blues, a G7 bar
    expect(['-2', '-3', '-4', '-5', '6'].map(of)).toEqual([
      'chord',
      'chord',
      'chord',
      'chord',
      'chord',
    ])
    expect(["-3'", '4', "-4'", '1'].map(of)).toEqual(['scale', 'scale', 'scale', 'scale'])
    expect(['5', '-6', '2'].map(of)).toEqual([null, null, null])
  })

  it('moves the chord tones with the bar', () => {
    const of = markOf(jamMarks(harp, 7, 0)) // a C7 bar: C E G Bb
    expect(['4', '5', '6', "-3'"].map(of)).toEqual(['chord', 'chord', 'chord', 'chord'])
    expect(['-3', '-4'].map(of)).toEqual([null, 'scale'])
  })
})
