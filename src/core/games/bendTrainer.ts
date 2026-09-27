import type { HarpNote } from '../harmonica/harp'
import type { ListenRoundConfig, ListenRoundState } from './listenRound'
import type { MatcherConfig } from './noteMatcher'
import { roundPoints, speedBonus, type GameMode } from './session'

export const BEND_LIMIT_MS = 10000

export function isBend(n: HarpNote): boolean {
  return n.technique === 'drawBend' || n.technique === 'blowBend'
}

/** The hole's higher reed — the note a bend starts from. */
export function unbentNote(harp: readonly HarpNote[], bend: HarpNote): HarpNote {
  const technique = bend.technique === 'blowBend' ? 'blow' : 'draw'
  const note = harp.find((n) => n.hole === bend.hole && n.technique === technique)
  if (!note) throw new Error(`No unbent note for hole ${bend.hole}`)
  return note
}

/** How many bend steps the hole of `bend` has (e.g. 3 on hole 3 draw). */
export function maxBendSteps(harp: readonly HarpNote[], bend: HarpNote): number {
  return Math.max(
    0,
    ...harp
      .filter((n) => n.hole === bend.hole && n.technique === bend.technique)
      .map((n) => n.bendSteps),
  )
}

/** Semitones (fractional) the live pitch sits below the unbent note. */
export function bendDepth(freq: number, unbentMidi: number, a4 = 440): number {
  return unbentMidi - (69 + 12 * Math.log2(freq / a4))
}

export function bendRoundConfig(
  mode: GameMode,
  matcher: MatcherConfig,
  a4: number,
): ListenRoundConfig {
  return { matcher, a4, limitMs: mode === 'scored' ? BEND_LIMIT_MS : null, helpAfterMs: null }
}

/** A clean hit earns at least half; a steady one all of it (decision 3). */
export function bendPoints(state: ListenRoundState): number {
  if (state.status !== 'hit' || state.timeMs === null) return 0
  const accuracy = 0.5 + 0.5 * (state.stability ?? 0)
  return roundPoints(accuracy, speedBonus(state.timeMs, BEND_LIMIT_MS))
}
