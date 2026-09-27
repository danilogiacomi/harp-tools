import { describe, expect, it } from 'vitest'
import { buildHarp } from '../harmonica/harp'
import { beatMs, parseTab, tabTimeline, textHash, type TabItem } from './parseTab'

const c = buildHarp('C')
const summary = (items: TabItem[]) =>
  items.map((i) =>
    i.kind === 'note'
      ? `${i.tab}=${i.note.midi}:${i.beats}`
      : i.kind === 'rest'
        ? `_:${i.beats}`
        : '|',
  )

describe('parseTab', () => {
  it('reads notes in every technique', () => {
    const { items, errors } = parseTab("4 -4 -3' -3'' 6o 7od 10''", c)
    expect(errors).toEqual([])
    expect(summary(items)).toEqual([
      '4=72:1',
      '-4=74:1',
      "-3'=70:1",
      "-3''=69:1",
      '6o=82:1',
      '7od=85:1',
      "10''=94:1",
    ])
  })

  it('reads durations, rests and bar lines, and ignores extra spaces', () => {
    const { items, errors } = parseTab('  4:2   -4:0.5 _ | _:1.5 5:.5\n6 ', c)
    expect(errors).toEqual([])
    expect(summary(items)).toEqual([
      '4=72:2',
      '-4=74:0.5',
      '_:1',
      '|',
      '_:1.5',
      '5=76:0.5',
      '6=79:1',
    ])
  })

  it('reports each bad token with its position', () => {
    const { items, errors } = parseTab("4 x -11 4:0 4:-1 4:: -4:2:1 4' 2od |", c)
    expect(summary(items)).toEqual(['4=72:1', '|'])
    expect(errors).toEqual([
      { position: 2, token: 'x', message: 'is not a note, rest (_) or bar line (|)' },
      { position: 3, token: '-11', message: 'is not a note, rest (_) or bar line (|)' },
      { position: 4, token: '4:0', message: 'the duration must be a positive number of beats' },
      { position: 5, token: '4:-1', message: 'the duration must be a positive number of beats' },
      { position: 6, token: '4::', message: 'has more than one duration' },
      { position: 7, token: '-4:2:1', message: 'has more than one duration' },
      { position: 8, token: "4'", message: "isn't on this harp" },
      { position: 9, token: '2od', message: "isn't on this harp" },
    ])
  })

  it('is key-relative: the same tab plays in any key', () => {
    const g = parseTab('4 -4', buildHarp('G'))
    expect(summary(g.items)).toEqual(['4=67:1', '-4=69:1'])
  })

  it("resolves against the tuning: a Paddy harp has no -3'' but a Country harp has -5'", () => {
    expect(parseTab("-3''", c).errors).toEqual([])
    expect(parseTab("-3''", buildHarp('C', 'paddy')).errors).toEqual([
      { position: 1, token: "-3''", message: "isn't on this harp" },
    ])
    expect(summary(parseTab("-5 -5'", buildHarp('C', 'country')).items)).toEqual([
      '-5=78:1',
      "-5'=77:1",
    ])
    expect(parseTab("-5'", c).errors).toHaveLength(1)
  })

  it('returns nothing for empty text', () => {
    expect(parseTab('   ', c)).toEqual({ items: [], errors: [] })
  })
})

describe('tabTimeline', () => {
  it('places notes on the beat grid; rests take time, bar lines do not', () => {
    const { items } = parseTab('4 -4:2 | _:0.5 5:1.5 |', c)
    const t = tabTimeline(items)
    expect(t.notes.map((n) => [n.index, n.tab, n.startBeat, n.beats])).toEqual([
      [0, '4', 0, 1],
      [1, '-4', 1, 2],
      [2, '5', 3.5, 1.5],
    ])
    expect(t.bars).toEqual([3, 5])
    expect(t.totalBeats).toBe(5)
  })
})

describe('beatMs', () => {
  it('is the length of a beat at a tempo', () => {
    expect(beatMs(120)).toBe(500)
    expect(beatMs(90)).toBeCloseTo(666.667, 3)
  })
})

describe('textHash', () => {
  it('is stable and tells different texts apart', () => {
    expect(textHash('4 -4 5')).toBe(textHash('4 -4 5'))
    expect(textHash('4 -4 5')).not.toBe(textHash('4 -4 6'))
    expect(textHash('')).toBe('45h')
  })
})
