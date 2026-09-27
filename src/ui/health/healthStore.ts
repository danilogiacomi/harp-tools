import type { HarpKey } from '../../core/harmonica/keys'
import type { TuningId } from '../../core/harmonica/tunings'

export const HEALTH_KEY = 'harp-tools:health'

/** One finished check: cents per reed in `healthReeds` order (null = skipped). */
export interface SavedHealth {
  /** Local date, YYYY-MM-DD. */
  date: string
  a4: number
  cents: (number | null)[]
}

export function healthId(key: HarpKey, tuning: TuningId): string {
  return `${key}|${tuning}`
}

const isSaved = (v: unknown): v is SavedHealth => {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  return (
    typeof r.date === 'string' &&
    typeof r.a4 === 'number' &&
    Number.isFinite(r.a4) &&
    Array.isArray(r.cents) &&
    r.cents.length === 20 &&
    r.cents.every((c) => c === null || (typeof c === 'number' && Number.isFinite(c)))
  )
}

function readAll(storage: Pick<Storage, 'getItem'> | null): Record<string, SavedHealth> {
  try {
    const raw: unknown = JSON.parse(storage?.getItem(HEALTH_KEY) ?? '{}')
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => isSaved(v))) as Record<
      string,
      SavedHealth
    >
  } catch {
    return {}
  }
}

export function loadHealth(
  storage: Pick<Storage, 'getItem'> | null,
  id: string,
): SavedHealth | null {
  return readAll(storage)[id] ?? null
}

/** Keeps only the latest check per key + tuning. Storage errors are ignored. */
export function saveHealth(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
  id: string,
  saved: SavedHealth,
): void {
  if (!storage) return
  try {
    storage.setItem(HEALTH_KEY, JSON.stringify({ ...readAll(storage), [id]: saved }))
  } catch {
    // Storage full or blocked: the previous check just won't be shown next time.
  }
}
