import { describe, expect, it } from 'vitest'
import { HOME_GROUPS, entryHref, pageTitle } from './homeGroups'

describe('HOME_GROUPS', () => {
  it('lists the pages in four groups', () => {
    expect(HOME_GROUPS.map((g) => [g.id, g.title, g.entries.map((e) => e.id)])).toEqual([
      ['tools', 'Tools', ['tuner', 'metronome', 'tone', 'health', 'positions']],
      [
        'games',
        'Games',
        [
          'echo',
          'bend',
          'scales',
          'intervals',
          'melody',
          'hole-finder',
          'quiz',
          'tab-reader',
          'licks',
          'rhythm',
          'hero',
        ],
      ],
      ['jam', 'Jam', ['jam']],
      ['progress', 'Progress', ['log']],
    ])
  })

  it('uses each id once, as the route', () => {
    const ids = HOME_GROUPS.flatMap((g) => g.entries.map((e) => e.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(entryHref(HOME_GROUPS[0].entries[0])).toBe('#/tuner')
  })
})

describe('pageTitle', () => {
  it('names a page by its Home entry, falling back to the id', () => {
    expect(pageTitle('echo')).toBe('Echo the note')
    expect(pageTitle('tuner')).toBe('Tuner')
    expect(pageTitle('something-new')).toBe('something-new')
  })
})
