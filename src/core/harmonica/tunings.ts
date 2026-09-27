export type TuningId = 'richter' | 'paddy' | 'country' | 'naturalMinor'

export interface Tuning {
  readonly id: TuningId
  readonly name: string
  readonly description: string
  /** Holes 1–10 as MIDI numbers on a harp labelled C; other keys transpose these. */
  readonly blow: readonly number[]
  readonly draw: readonly number[]
}

const RICHTER_BLOW = [60, 64, 67, 72, 76, 79, 84, 88, 91, 96]
const RICHTER_DRAW = [62, 67, 71, 74, 77, 81, 83, 86, 89, 93]

export const TUNINGS: readonly Tuning[] = [
  {
    id: 'richter',
    name: 'Richter',
    description: 'Standard diatonic tuning.',
    blow: RICHTER_BLOW,
    draw: RICHTER_DRAW,
  },
  {
    id: 'paddy',
    name: 'Paddy Richter',
    description: 'Hole 3 blow raised a whole step (A on a C harp), for 1st-position melodies.',
    blow: [60, 64, 69, 72, 76, 79, 84, 88, 91, 96],
    draw: RICHTER_DRAW,
  },
  {
    id: 'country',
    name: 'Country',
    description: 'Hole 5 draw raised a half step (F# on a C harp), for major keys in 2nd position.',
    blow: RICHTER_BLOW,
    draw: [62, 67, 71, 74, 78, 81, 83, 86, 89, 93],
  },
  {
    id: 'naturalMinor',
    name: 'Natural minor',
    description: 'Minor 3rd, 6th and 7th; labelled by its blow key, for minor in 1st position.',
    blow: [60, 63, 67, 72, 75, 79, 84, 87, 91, 96],
    draw: [62, 67, 70, 74, 77, 80, 82, 86, 89, 92],
  },
]

export const TUNING_IDS: readonly TuningId[] = TUNINGS.map((t) => t.id)

export function tuningById(id: TuningId): Tuning {
  return TUNINGS.find((t) => t.id === id) ?? TUNINGS[0]
}
