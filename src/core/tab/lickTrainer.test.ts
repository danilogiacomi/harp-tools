import { describe, expect, it } from 'vitest'
import { buildHarp } from '../harmonica/harp'
import { scriptedRng } from '../games/random'
import { LICKS } from './licks'
import { lickNotes, pickLick, playableLicks, promptNotes } from './lickTrainer'
import { parseTab } from './parseTab'

const c = buildHarp('C')
const blues = LICKS.filter((l) => l.style === 'blues2')

describe('lickNotes', () => {
  it('gives the lick’s pitches and beats on this harp', () => {
    const notes = lickNotes(
      LICKS.find((l) => l.id === 'root-fifth')!,
      c,
    )!
    expect(notes.map((n) => [n.tab, n.note.midi, n.beats])).toEqual([
      ['-2', 67, 1],
      ['-3', 71, 1],
      ['4', 72, 1],
      ['-4', 74, 3],
    ])
  })
})

describe('playableLicks', () => {
  it('drops licks that need a note the harp lacks', () => {
    expect(playableLicks(blues, c)).toHaveLength(10)
    const noBends = c.filter((n) => n.technique !== 'drawBend')
    expect(playableLicks(blues, noBends).map((l) => l.id)).toEqual([
      'root-fifth',
      'call',
      'shuffle-riff',
      'turnaround-down',
    ])
  })
})

describe('pickLick', () => {
  it('picks at random without repeating the previous lick', () => {
    expect(pickLick(blues, scriptedRng([0.25]), null).id).toBe('root-fifth')
    // without 'root-fifth' the list is 9 long: 0.25 × 9 = 2.25 → index 2 = 'bend-release'
    expect(pickLick(blues, scriptedRng([0.25]), 'root-fifth').id).toBe('bend-release')
    expect(pickLick(blues.slice(0, 1), scriptedRng([0.9]), 'blues-up').id).toBe('blues-up')
  })
})

describe('promptNotes', () => {
  it('times notes and rests at the tempo and skips bar lines', () => {
    const { items } = parseTab('-2:0.5 _ | 4:2', c)
    expect(promptNotes(items, 120)).toEqual([
      { midi: 67, ms: 250 },
      { midi: null, ms: 500 },
      { midi: 72, ms: 1000 },
    ])
  })
})
