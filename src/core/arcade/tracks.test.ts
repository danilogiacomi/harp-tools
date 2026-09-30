import { describe, expect, it } from 'vitest'
import { buildHarp, type HarpNote } from '../harmonica/harp'
import { HARP_KEYS } from '../harmonica/keys'
import { bluesForm, chordPcs, chordRootPc } from '../jam/blues'
import { parseTab, tabTimeline, type TabNoteItem } from '../tab/parseTab'
import { bandConfig, noteCount, songBars, songForm, TRACKS, type Track } from './tracks'

const C_HARP = buildHarp('C')
/** The part's bars, split at its bar lines. */
const barsOf = (t: Track) => t.part.split('|').map((b) => b.trim())
const notesOf = (text: string) =>
  parseTab(text, C_HARP).items.filter((i): i is TabNoteItem => i.kind === 'note')
/** Spec §4.4: blow and draw for 1–2, half-step draw bends from 3, any draw bend from 4. */
const allowed = (rating: number, n: HarpNote) => {
  if (n.technique === 'blow' || n.technique === 'draw') return true
  if (n.technique !== 'drawBend') return false
  return rating >= 4 || (rating === 3 && n.bendSteps === 1)
}

describe('TRACKS', () => {
  it('has six tracks with unique ids, easiest first', () => {
    expect(TRACKS.map((t) => t.id)).toEqual([
      'porch-shuffle',
      'three-chord-train',
      'low-down',
      'bent-out-of-shape',
      'second-gear',
      'overdrive',
    ])
    expect(TRACKS.map((t) => t.rating)).toEqual([1, 1, 2, 3, 4, 5])
  })

  describe.each(TRACKS.map((t) => [t.title, t] as const))('%s', (_title, track) => {
    it('plays on a Richter harp in every key', () => {
      for (const key of HARP_KEYS) expect(parseTab(track.part, buildHarp(key)).errors).toEqual([])
    })

    it('fills the form: choruses × 12 bars of 4 beats each', () => {
      const bars = barsOf(track)
      expect(bars).toHaveLength(songBars(track))
      for (const bar of bars) {
        const beats = parseTab(bar, C_HARP).items.reduce(
          (sum, i) => sum + (i.kind === 'bar' ? 0 : i.beats),
          0,
        )
        expect(beats, bar).toBe(4)
      }
    })

    it('only uses the techniques its rating allows', () => {
      for (const n of notesOf(track.part)) expect(allowed(track.rating, n.note), n.tab).toBe(true)
    })

    it('starts every IV and V bar on a tone of its chord', () => {
      const form = songForm(track)
      barsOf(track).forEach((bar, i) => {
        if (form[i] === 'I') return
        // A C harp in 2nd position plays in G.
        const chord = chordPcs(chordRootPc(7, form[i]))
        expect(chord, `bar ${i + 1}: ${bar}`).toContain(notesOf(bar)[0].note.midi % 12)
      })
    })

    it('uses notes of a beat or longer on a shuffle', () => {
      if (track.feel !== 'shuffle') return
      for (const n of notesOf(track.part)) expect(n.beats, n.tab).toBeGreaterThanOrEqual(1)
    })

    it('counts its notes', () => {
      expect(noteCount(track)).toBe(tabTimeline(parseTab(track.part, C_HARP).items).notes.length)
    })
  })

  it('sets the band up in 2nd position, once through after a bar of count-in', () => {
    const porch = TRACKS[0]
    expect(bandConfig(porch, 'C', 0.75)).toEqual({
      bpm: 60,
      feel: 'shuffle',
      form: songForm(porch),
      tonicPc: 7,
      countInBars: 1,
      loop: false,
    })
    expect(bandConfig(porch, 'A', 1).tonicPc).toBe(4) // an A harp jams in E
    expect(songForm({ ...porch, choruses: 2, quickChange: true })).toEqual([
      ...bluesForm(true),
      ...bluesForm(true),
    ])
    expect(songBars(porch)).toBe(24)
  })
})
