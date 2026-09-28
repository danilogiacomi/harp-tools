import type { TuningId } from '../../core/harmonica/tunings'

export type GameId =
  | 'echo'
  | 'bend'
  | 'scales'
  | 'intervals'
  | 'melody'
  | 'hole-finder'
  | 'quiz'
  | 'rhythm'
  | 'tab-reader'
  | 'licks'

export const BEST_SCORES_KEY = 'harp-tools:best-scores'

type BestMap = Record<string, number>

/** One key per game and settings combination, e.g. `echo|key=C|tol=25`. */
export function bestScoreKey(
  game: GameId,
  parts: Record<string, string | number | boolean>,
): string {
  const fields = Object.keys(parts)
    .sort()
    .map((k) => `${k}=${String(parts[k])}`)
  return [game, ...fields].join('|')
}

/**
 * The tuning part of a best-score key (spec §1): nothing for Richter, so the keys saved before
 * tunings existed still match; `{ tuning }` for the others.
 */
export function tuningPart(tuning: TuningId): Record<string, string> {
  return tuning === 'richter' ? {} : { tuning }
}

function readAll(storage: Pick<Storage, 'getItem'> | null): BestMap {
  try {
    const raw: unknown = JSON.parse(storage?.getItem(BEST_SCORES_KEY) ?? '{}')
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
    const out: BestMap = {}
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

export function loadBest(storage: Pick<Storage, 'getItem'> | null, key: string): number | null {
  return readAll(storage)[key] ?? null
}

/** Stores `score` if it beats the saved best; true when it did (and the write succeeded). */
export function saveBestIfHigher(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
  key: string,
  score: number,
): boolean {
  if (!storage) return false
  const all = readAll(storage)
  const previous = all[key]
  if (previous !== undefined && previous >= score) return false
  try {
    storage.setItem(BEST_SCORES_KEY, JSON.stringify({ ...all, [key]: score }))
    return true
  } catch {
    return false
  }
}
