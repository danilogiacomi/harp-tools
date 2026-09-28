export interface HomeEntry {
  /** The route without its slash (`#/echo`) and the page's practice-log id. */
  readonly id: string
  readonly icon: string
  readonly title: string
  readonly text: string
}

export type HomeGroupId = 'tools' | 'games' | 'jam' | 'progress'

export interface HomeGroup {
  readonly id: HomeGroupId
  readonly title: string
  readonly entries: readonly HomeEntry[]
}

/** Spec §0: the Home page, in order. New pages add their entry here. */
export const HOME_GROUPS: readonly HomeGroup[] = [
  {
    id: 'tools',
    title: 'Tools',
    entries: [
      {
        id: 'tuner',
        icon: '🎯',
        title: 'Tuner',
        text: 'See which hole and technique you are playing, or hear any note on your harp.',
      },
      {
        id: 'metronome',
        icon: '🥁',
        title: 'Metronome',
        text: 'Steady time with tap tempo, accents and subdivisions.',
      },
      {
        id: 'tone',
        icon: '🌬️',
        title: 'Tone & breath meter',
        text: 'See how steady your pitch and breath are, and measure your vibrato.',
      },
      {
        id: 'health',
        icon: '🩺',
        title: 'Harp health check',
        text: 'Measure every reed against the tuner and find the ones out of tune.',
      },
      {
        id: 'positions',
        icon: '🧭',
        title: 'Positions & keys',
        text: 'Which harp to use for a song, and what each harp plays in every position.',
      },
    ],
  },
  {
    id: 'games',
    title: 'Games',
    entries: [
      { id: 'echo', icon: '👂', title: 'Echo the note', text: 'Hear a note, then play it back.' },
      {
        id: 'bend',
        icon: '〰️',
        title: 'Bend trainer',
        text: 'Hit and hold a target bend on a live meter.',
      },
      {
        id: 'scales',
        icon: '🪜',
        title: 'Scale runner',
        text: 'Scales in 1st, 2nd and 3rd position.',
      },
      {
        id: 'intervals',
        icon: '🎼',
        title: 'Interval training',
        text: 'Name or play the interval you hear.',
      },
      {
        id: 'melody',
        icon: '🔁',
        title: 'Melody echo',
        text: 'Repeat phrases that grow as you improve.',
      },
      {
        id: 'hole-finder',
        icon: '🔎',
        title: 'Hole finder',
        text: 'See a note name, find it on your harp and play it.',
      },
      {
        id: 'quiz',
        icon: '🎓',
        title: 'Note quiz',
        text: 'Name the highlighted hole, or find the hole for a note. No mic needed.',
      },
      {
        id: 'rhythm',
        icon: '⏱️',
        title: 'Rhythm trainer',
        text: 'Play in time with the metronome: quarters, shuffles, the train beat.',
      },
    ],
  },
  { id: 'jam', title: 'Jam', entries: [] },
  {
    id: 'progress',
    title: 'Progress',
    entries: [
      {
        id: 'log',
        icon: '📈',
        title: 'Practice log',
        text: 'Streaks, time practised per day and page, and your recent scores.',
      },
    ],
  },
]

export function entryHref(entry: HomeEntry): string {
  return `#/${entry.id}`
}

export function pageTitle(pageId: string): string {
  for (const group of HOME_GROUPS) {
    const entry = group.entries.find((e) => e.id === pageId)
    if (entry) return entry.title
  }
  return pageId
}
