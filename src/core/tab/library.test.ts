import { describe, expect, it } from 'vitest'
import { buildHarp } from '../harmonica/harp'
import { HARP_KEYS } from '../harmonica/keys'
import { TUNINGS } from '../harmonica/tunings'
import { LICKS, LICK_STYLES } from './licks'
import { parseTab, tabTimeline } from './parseTab'
import { SONGS } from './songs'

const richterC = buildHarp('C')
const tabsOf = (tab: string) => tabTimeline(parseTab(tab, richterC).items).notes.map((n) => n.tab)

describe('song library', () => {
  it('has the eight spec songs, Happy Birthday replaced by Swing Low', () => {
    expect(SONGS.map((s) => s.title)).toEqual([
      'Mary Had a Little Lamb',
      'Twinkle Twinkle Little Star',
      'Ode to Joy',
      'Oh! Susanna',
      'When the Saints Go Marching In',
      'Amazing Grace',
      'Red River Valley',
      'Swing Low, Sweet Chariot',
    ])
    expect(new Set(SONGS.map((s) => s.id)).size).toBe(SONGS.length)
  })

  it('fills every bar with exactly the song’s beats', () => {
    for (const song of SONGS) {
      const { items } = parseTab(song.tab, richterC)
      let beats = 0
      for (const item of items) {
        if (item.kind === 'bar') {
          expect([song.id, beats]).toEqual([song.id, song.beatsPerBar])
          beats = 0
        } else beats += item.beats
      }
      expect([song.id, beats]).toEqual([song.id, 0])
    }
  })

  it('stays in holes 4–9 without bends, except one low -2 in Ode to Joy', () => {
    const tabs = SONGS.flatMap((s) => tabsOf(s.tab))
    expect(tabs.filter((t) => !/^-?[4-9]$/.test(t))).toEqual(['-2'])
  })

  it('pins the opening of every song to its well-known melody', () => {
    const openings: Record<string, string[]> = {
      mary: ['5', '-4', '4', '-4', '5', '5', '5', '-4'],
      twinkle: ['4', '4', '6', '6', '-6', '-6', '6', '-5'],
      ode: ['5', '5', '-5', '6', '6', '-5', '5', '-4'],
      susanna: ['4', '-4', '5', '6', '6', '-6', '6', '5'],
      saints: ['4', '5', '-5', '6', '4', '5', '-5', '6'],
      'amazing-grace': ['6', '7', '8', '7', '8', '-8', '7', '-6'],
      'red-river': ['6', '7', '8', '8', '8', '-8', '8', '-8'],
      'swing-low': ['5', '4', '5', '5', '5', '5', '6', '-6'],
    }
    for (const song of SONGS) {
      expect([song.id, tabsOf(song.tab).slice(0, 8)]).toEqual([song.id, openings[song.id]])
    }
  })
})

describe('corrected melodies', () => {
  it('pins the whole chorus of Oh! Susanna', () => {
    const song = SONGS.find((s) => s.id === 'susanna')!
    // “Oh, Susanna, oh don't you cry for me, for I come from Alabama with my banjo on my knee.”
    expect(tabsOf(song.tab).slice(-25)).toEqual(
      '-5 -5 -6 -6 -6 6 6 5 4 -4 4 -4 5 6 6 -6 6 5 4 -4 5 5 -4 -4 4'.split(' '),
    )
  })

  it('pins all of Red River Valley', () => {
    const song = SONGS.find((s) => s.id === 'red-river')!
    expect(tabsOf(song.tab)).toEqual(
      (
        '6 7 8 8 8 -8 8 -8 7 6 7 8 7 8 9 -9 8 -8 ' +
        '9 -9 8 8 -8 7 -8 8 9 -9 -6 -6 6 -7 7 -8 8 -8 7'
      ).split(' '),
    )
  })
})

describe('lick library', () => {
  it('has 10 blues, 3 folk and 3 minor licks with unique ids', () => {
    const count = (style: string) => LICKS.filter((l) => l.style === style).length
    expect(LICK_STYLES.map((s) => [s.id, count(s.id)])).toEqual([
      ['blues2', 10],
      ['folk1', 3],
      ['minor3', 3],
    ])
    expect(new Set(LICKS.map((l) => l.id)).size).toBe(16)
  })

  it('keeps licks short: 4–8 notes', () => {
    for (const lick of LICKS) {
      const n = tabsOf(lick.tab).length
      expect([lick.id, n >= 4 && n <= 8]).toEqual([lick.id, true])
    }
  })

  it('uses only the notes each style is written around', () => {
    const allowed = {
      blues2: ['-2', "-3'", '-3', '4', "-4'", '-4', '5', '-5', '6'],
      folk1: ['4', '-4', '5', '-5', '6', '-6', '-7', '7'],
      minor3: ['-4', '5', '-5', '6', '-6', '7'],
    }
    for (const lick of LICKS) {
      const extra = tabsOf(lick.tab).filter((t) => !allowed[lick.style].includes(t))
      expect([lick.id, extra]).toEqual([lick.id, []])
    }
  })

  it('has one bend-focused blues lick (a 1-step bend and its release)', () => {
    expect(tabsOf(LICKS.find((l) => l.id === 'bend-release')!.tab).slice(0, 2)).toEqual([
      "-3'",
      '-3',
    ])
  })
})

describe('every song and lick', () => {
  it('parses on every key and tuning', () => {
    const failures: string[] = []
    for (const tuning of TUNINGS) {
      for (const key of HARP_KEYS) {
        const harp = buildHarp(key, tuning.id)
        for (const { id, tab } of [...SONGS, ...LICKS]) {
          for (const e of parseTab(tab, harp).errors)
            failures.push(`${id} on ${key} ${tuning.id}: ${e.token}`)
        }
      }
    }
    expect(failures).toEqual([])
  })
})
