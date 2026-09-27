import { noteId, type HarpNote } from '../harmonica/harp'
import { pickOne, type Rng } from './random'
import { roundPoints, speedBonus } from './session'

/** Spec §4: the speed bonus runs from ×2 (instant) to ×1 at 10 s; there is no timeout. */
export const QUIZ_BONUS_MS = 10_000

export const PITCH_CLASSES: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

/** A random box from the pool, not the previous one when there is a choice. */
export function pickQuizNote(
  pool: readonly HarpNote[],
  rng: Rng,
  previous: HarpNote | null,
): HarpNote {
  const choices =
    previous && pool.length > 1 ? pool.filter((n) => noteId(n) !== noteId(previous)) : pool
  return pickOne(choices, rng)
}

export function isRightName(note: HarpNote, pc: number): boolean {
  return ((note.midi % 12) + 12) % 12 === pc
}

/** Any box that sounds exactly the asked pitch is right. */
export function isRightHole(targetMidi: number, clicked: HarpNote): boolean {
  return clicked.midi === targetMidi
}

export function quizPoints(correct: boolean, elapsedMs: number): number {
  return correct ? roundPoints(1, speedBonus(elapsedMs, QUIZ_BONUS_MS)) : 0
}
