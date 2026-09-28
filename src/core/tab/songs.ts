/** A built-in tune for the tab reader: public domain, 1st position, key-relative tab. */
export interface Song {
  id: string
  title: string
  /** Beats per bar, for the count-in and the metronome (the tab itself is written in beats). */
  beatsPerBar: 3 | 4
  tab: string
}

export const SONGS: readonly Song[] = [
  {
    id: 'mary',
    title: 'Mary Had a Little Lamb',
    beatsPerBar: 4,
    tab: '5 -4 4 -4 | 5 5 5:2 | -4 -4 -4:2 | 5 6 6:2 | 5 -4 4 -4 | 5 5 5 5 | -4 -4 5 -4 | 4:4 |',
  },
  {
    id: 'twinkle',
    title: 'Twinkle Twinkle Little Star',
    beatsPerBar: 4,
    tab:
      '4 4 6 6 | -6 -6 6:2 | -5 -5 5 5 | -4 -4 4:2 | 6 6 -5 -5 | 5 5 -4:2 | ' +
      '6 6 -5 -5 | 5 5 -4:2 | 4 4 6 6 | -6 -6 6:2 | -5 -5 5 5 | -4 -4 4:2 |',
  },
  {
    id: 'ode',
    title: 'Ode to Joy',
    beatsPerBar: 4,
    tab:
      '5 5 -5 6 | 6 -5 5 -4 | 4 4 -4 5 | 5:1.5 -4:0.5 -4:2 | ' +
      '5 5 -5 6 | 6 -5 5 -4 | 4 4 -4 5 | -4:1.5 4:0.5 4:2 | ' +
      '-4 -4 5 4 | -4 5:0.5 -5:0.5 5 4 | -4 5:0.5 -5:0.5 5 -4 | 4 -4 -2:2 | ' +
      '5 5 -5 6 | 6 -5 5 -4 | 4 4 -4 5 | -4:1.5 4:0.5 4:2 |',
  },
  {
    id: 'susanna',
    title: 'Oh! Susanna',
    beatsPerBar: 4,
    tab:
      '_:3 4:0.5 -4:0.5 | 5 6 6:1.5 -6:0.5 | 6 5 4:1.5 -4:0.5 | 5 5 -4 4 | -4:3 4:0.5 -4:0.5 | ' +
      '5 6 6:1.5 -6:0.5 | 6 5 4:1.5 -4:0.5 | 5 5 -4 -4 | 4:4 | ' +
      '-5:2 -5:2 | -6 -6:2 -6 | 6 6 5 4 | -4:3 4:0.5 -4:0.5 | ' +
      '5 6 6:1.5 -6:0.5 | 6 5 4:1.5 -4:0.5 | 5 5 -4 -4 | 4:4 |',
  },
  {
    id: 'saints',
    title: 'When the Saints Go Marching In',
    beatsPerBar: 4,
    tab:
      '_ 4 5 -5 | 6:4 | _ 4 5 -5 | 6:4 | _ 4 5 -5 | 6:2 5:2 | 4:2 5:2 | -4:4 | ' +
      '_ 5 5 -4 | 4:3 4 | 5:2 6 6 | -5:3 5 | -5 6:2 5 | 4:2 -4:2 | 4:4 |',
  },
  {
    id: 'amazing-grace',
    title: 'Amazing Grace',
    beatsPerBar: 3,
    tab:
      '_:2 6 | 7:2 8:0.5 7:0.5 | 8:2 -8 | 7:2 -6 | 6:2 6 | 7:2 8:0.5 7:0.5 | 8:2 -8 | 9:3 | ' +
      '_:2 8 | 9:2 8:0.5 9:0.5 | 8:2 7 | 6:2 -6 | 7:2 -6 | 6:2 6 | 7:2 8:0.5 7:0.5 | 8:2 -8 | 7:3 |',
  },
  {
    id: 'red-river',
    title: 'Red River Valley',
    beatsPerBar: 4,
    tab:
      '_:2 6 7 | 8:1.5 8:0.5 8 -8 | 8:1.5 -8:0.5 7:2 | _:2 6 7 | 8:1.5 7:0.5 8 9 | -9 8 -8:2 | ' +
      '_:2 9 -9 | 8:1.5 8:0.5 -8 7 | -8:1.5 8:0.5 9 -9 | _:2 -6 -6 | 6 -7:0.5 7:0.5 -8 8:0.5 -8:0.5 | 7:4 |',
  },
  {
    id: 'swing-low',
    title: 'Swing Low, Sweet Chariot',
    beatsPerBar: 4,
    tab:
      '5:2 4:1.5 5:0.5 | 5 5:0.5 5:0.5 6:2 | -6:1.5 6:0.5 6 5 | 6:1.5 5:0.5 -4:2 | ' +
      '5:2 4:1.5 5:0.5 | 5 5:0.5 5:0.5 6:2 | -6:1.5 6:0.5 6 5 | -4:1.5 -4:0.5 4:2 |',
  },
]
