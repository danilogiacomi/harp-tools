import type { HarpNote } from '../harmonica/harp'
import { pickOne, type Rng } from '../games/random'
import type { Lick } from './licks'
import { beatMs, parseTab, tabTimeline, type TabItem, type TimedNote } from './parseTab'

/** A lick's notes on this harp, or null when its tab doesn't fit the harp's tuning. */
export function lickNotes(lick: Lick, harp: readonly HarpNote[]): TimedNote[] | null {
  const { items, errors } = parseTab(lick.tab, harp)
  return errors.length > 0 ? null : tabTimeline(items).notes
}

/** The licks whose tab fits this harp (a missing bend makes a lick unplayable). */
export function playableLicks(licks: readonly Lick[], harp: readonly HarpNote[]): Lick[] {
  return licks.filter((l) => lickNotes(l, harp) !== null)
}

/** A random lick, not the previous one when there is a choice. */
export function pickLick(licks: readonly Lick[], rng: Rng, previousId: string | null): Lick {
  const choices = licks.length > 1 ? licks.filter((l) => l.id !== previousId) : licks
  return pickOne(choices, rng)
}

/** The notes and rests to play at `bpm`, each with its length in ms (bar lines skipped). */
export function promptNotes(
  items: readonly TabItem[],
  bpm: number,
): { midi: number | null; ms: number }[] {
  const beat = beatMs(bpm)
  return items.flatMap((i) =>
    i.kind === 'bar' ? [] : [{ midi: i.kind === 'note' ? i.note.midi : null, ms: i.beats * beat }],
  )
}
