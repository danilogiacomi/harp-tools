import type { HarpKey } from '../harmonica/keys'
import { positionTonicPc } from '../harmonica/positions'
import type { BackingConfig, Feel } from '../jam/backingSchedule'
import { bluesForm, type Degree } from '../jam/blues'

export interface Track {
  id: string
  title: string
  /** 1 (holes 4–6, no bends) to 5 (deep bends and fast runs); spec §4.4. */
  rating: 1 | 2 | 3 | 4 | 5
  bpm: number
  feel: Feel
  /** How many times the 12-bar form repeats. */
  choruses: number
  quickChange: boolean
  /** The harp part in tab notation (parseTab), for a Richter harp in 2nd position. */
  part: string
}

export const TRACK_BEATS_PER_BAR = 4
export const COUNT_IN_BARS = 1
export const BARS_PER_CHORUS = 12

/** One chorus: 12 bars of tab, 4 beats each. */
type Chorus = readonly string[]
const part = (...choruses: Chorus[]) => choruses.flat().join(' | ')

const PORCH_1: Chorus = [
  '6:4',
  '-5:2 -4:2',
  '6:2 -6:2',
  '6:4',
  '5:4',
  '4:2 5:2',
  '6:2 -5:2',
  '-4:4',
  '-6:4',
  '5:2 4:2',
  '-4:2 6:2',
  '-4:4',
]
const PORCH_2: Chorus = [
  '-5:2 -4:2',
  '6:4',
  '-4:2 -6:2',
  '-5:2 -4:2',
  '4:2 5:2',
  '6:2 5:2',
  '-5:2 -4:2',
  '6:4',
  '-6:2 -4:2',
  '5:4',
  '-4:2 6:2',
  '-4:4',
]

const TRAIN_TURN: Chorus = [
  '4 5 6 5',
  '4 5 6:2',
  '-4 -5 6 -5',
  '-4 -5 6:2',
  '-4 -6 -4 -6',
  '4 5 6 5',
  '-4 -5 6 -5',
  '-4 -6 -4:2',
]
const TRAIN_1: Chorus = ['-4 -5 6 -5', '-4 -5 6 -5', '-4 -5 6 -5', '-4 -5 6:2', ...TRAIN_TURN]
const TRAIN_2: Chorus = ['6 -5 -4 -5', '6 -5 -4 -5', '6 -5 -4 -5', '6 -5 -4:2', ...TRAIN_TURN]

const LOW_1: Chorus = [
  '-2:2 -3 -4',
  '-3 -2 _:2',
  '-2 -3 -4 -3',
  '-2:3 _',
  '2:2 -2 2',
  '1:2 2:2',
  '-2 -3 -4 -3',
  '-2:4',
  '-4:2 -1:2',
  '4 -3 2:2',
  '-2 -3 -4:2',
  '-1:2 -4:2',
]
const LOW_2: Chorus = [
  '-2 -3 -4:2',
  '-3 -2 -1:2',
  '-2 -3 -4 -3',
  '-2:2 -1:2',
  '4:2 2 1',
  '2 -2 2 1',
  '-2 -3 -4 -3',
  '-2:2 _:2',
  '-1:2 -4:2',
  '1 2 -2 2',
  '-2 -3 -4 -3',
  '-4:2 -1:2',
]

const BENT_1: Chorus = [
  "-2:2 -3' -3",
  '-2:4',
  "-3' 4 -4' -4",
  "-5:2 -3':2",
  "4:3 -3'",
  '4 5 4:2',
  "-3' -3 -2 -3",
  '-2:4',
  "-4:3 -4'",
  "4:2 -3':2",
  '-3 -2:3',
  '-4:4',
]
const BENT_2: Chorus = [
  "-5 -4 -4' 4",
  "-3' -2:3",
  "-3' 4 -4' -4",
  '-5:2 6:2',
  "5 4 -3':2",
  '4:4',
  "-3' -3 -2 -3",
  '-2:2 _:2',
  "-4:2 -4' 4",
  "-3':2 4:2",
  '-3 -2:3',
  '-4:4',
]

// Quick change: I IV I I | IV IV I I | V IV I V.
const GEAR_RUN = "-2:.5 -3':.5 -3:.5 -4:.5 -5:2"
const GEAR_DROP = "-4:.5 -5:.5 -4:.5 -3':.5 -2:2"
const GEAR_TURN = "-2:.5 -3':.5 -3:.5 -2:.5 -2':2"
const GEAR_END = "-1 -2' -3'':2"
const GEAR_A: Chorus = [
  GEAR_RUN,
  "4:2 -3' 4",
  "-2:.5 -3':.5 -3:.5 -4:.5 -2:2",
  "-3'' -3' -2:2",
  '4:.5 5:.5 6:.5 5:.5 4:2',
  "-3':.5 4:.5 5 6:2",
  GEAR_RUN,
  "-4:2 -3' -2",
  "-4:.5 -3'':.5 -4:.5 -3'':.5 -2':2",
  "5 4 -3':2",
  GEAR_TURN,
  GEAR_END,
]
const GEAR_B: Chorus = [
  GEAR_DROP,
  "4:.5 5:.5 4:.5 -3':.5 4:2",
  "-2:2 -3'' -2",
  "-3:.5 -3':.5 -2 -2' -2",
  '1 2 -2 2',
  "4:2 -3':2",
  GEAR_RUN,
  GEAR_DROP,
  "-1:.5 -2':.5 -3'':.5 -4:.5 -3'':2",
  "5 4 -3':2",
  GEAR_TURN,
  GEAR_END,
]

const DRIVE_CLIMB = "-2:.5 -3''':.5 -3'':.5 -3':.5 -3:.5 -4:.5 -3"
const DRIVE_V = "-1:.5 -2':.5 -3'':.5 -4:.5 -3'':.5 -2':.5 -1"
const DRIVE_IV = "1:.5 2:.5 -2:.5 -3':.5 4:2"
const DRIVE_FALL = "-4:.5 -3:.5 -3':.5 -3'':.5 -3''':.5 -2:.5 -2''"
const DRIVE_A: Chorus = [
  DRIVE_CLIMB,
  "4:.5 5:.5 4:.5 -3':.5 4:2",
  "-2:.5 -2'':.5 -2:.5 -3':.5 -3:.5 -2:.5 -1",
  "-2'':.5 -1:.5 -2:.5 -3':.5 -4:2",
  '1:.5 2:.5 -2:.5 2:.5 1:2',
  "4:.5 -3':.5 4:.5 5:.5 6:2",
  "-2:.5 -3''':.5 -3'':.5 -3':.5 -3:.5 -4:.5 -5",
  "-4:.5 -3:.5 -3':.5 -2:.5 -2'':2",
  DRIVE_V,
  DRIVE_IV,
  DRIVE_FALL,
  GEAR_END,
]
const DRIVE_B: Chorus = [
  "-4:.5 -5:.5 6:.5 -5:.5 -4:.5 -3':.5 -2",
  '4:.5 5:.5 6:.5 5:.5 4:2',
  DRIVE_CLIMB,
  "-2:.5 -2'':.5 -1:.5 -2'':.5 -2:2",
  "4:.5 -3':.5 4:.5 5:.5 6:2",
  "5:.5 4:.5 -3':.5 4:.5 5:2",
  "-2:.5 -3':.5 -3:.5 -4:.5 -5:.5 -4:.5 -3",
  "-2:2 -2'' -3'",
  DRIVE_V,
  DRIVE_IV,
  DRIVE_FALL,
  GEAR_END,
]

/** Spec §4.4: easiest first. */
export const TRACKS: readonly Track[] = [
  {
    id: 'porch-shuffle',
    title: 'Porch Shuffle',
    rating: 1,
    bpm: 80,
    feel: 'shuffle',
    choruses: 2,
    quickChange: false,
    part: part(PORCH_1, PORCH_2),
  },
  {
    id: 'three-chord-train',
    title: 'Three Chord Train',
    rating: 1,
    bpm: 92,
    feel: 'straight',
    choruses: 2,
    quickChange: false,
    part: part(TRAIN_1, TRAIN_2),
  },
  {
    id: 'low-down',
    title: 'Low Down',
    rating: 2,
    bpm: 76,
    feel: 'shuffle',
    choruses: 2,
    quickChange: false,
    part: part(LOW_1, LOW_2),
  },
  {
    id: 'bent-out-of-shape',
    title: 'Bent Out of Shape',
    rating: 3,
    bpm: 70,
    feel: 'shuffle',
    choruses: 2,
    quickChange: false,
    part: part(BENT_1, BENT_2),
  },
  {
    id: 'second-gear',
    title: 'Second Gear',
    rating: 4,
    bpm: 108,
    feel: 'straight',
    choruses: 3,
    quickChange: true,
    part: part(GEAR_A, GEAR_B, GEAR_A),
  },
  {
    id: 'overdrive',
    title: 'Overdrive',
    rating: 5,
    bpm: 120,
    feel: 'straight',
    choruses: 3,
    quickChange: true,
    part: part(DRIVE_A, DRIVE_B, DRIVE_A),
  },
]

/** The chords the band plays: the 12-bar form, `choruses` times. */
export function songForm(track: Track): Degree[] {
  return Array.from({ length: track.choruses }, () => bluesForm(track.quickChange)).flat()
}

export function songBars(track: Track): number {
  return track.choruses * BARS_PER_CHORUS
}

/** Spec §1.1: the band in 2nd position on this harp, a bar of count-in, the form played once. */
export function bandConfig(track: Track, key: HarpKey, speed: number): BackingConfig {
  return {
    bpm: track.bpm * speed,
    feel: track.feel,
    form: songForm(track),
    tonicPc: positionTonicPc(key, 2),
    countInBars: COUNT_IN_BARS,
    loop: false,
  }
}

/** How many notes the part has (not rests or bar lines), without parsing it against a harp. */
export function noteCount(track: Track): number {
  return track.part.split(/\s+/).filter((t) => t !== '' && t !== '|' && !t.startsWith('_')).length
}
