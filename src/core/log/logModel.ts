import { DATE_RE } from './dates'

export interface SessionEntry {
  readonly date: string
  readonly game: string
  readonly score: number
  readonly max: number
}

export interface PracticeLog {
  /** `days[date][pageId]` = seconds practised on that page that day. */
  readonly days: Readonly<Record<string, Readonly<Record<string, number>>>>
  /** Finished scored sessions, oldest first. */
  readonly sessions: readonly SessionEntry[]
}

export const MAX_SESSIONS = 200

export function emptyLog(): PracticeLog {
  return { days: {}, sessions: [] }
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isAmount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0

function cleanSession(v: unknown): SessionEntry | null {
  if (!isObject(v)) return null
  const { date, game, score, max } = v
  if (typeof date !== 'string' || !DATE_RE.test(date)) return null
  if (typeof game !== 'string' || game === '') return null
  if (!isAmount(score) || !isAmount(max)) return null
  return { date, game, score, max }
}

/** Anything read from storage → a valid log; bad entries are dropped one by one. */
export function sanitizeLog(raw: unknown): PracticeLog {
  if (!isObject(raw)) return emptyLog()
  const days: Record<string, Record<string, number>> = {}
  if (isObject(raw.days)) {
    for (const [date, pages] of Object.entries(raw.days)) {
      if (!DATE_RE.test(date) || !isObject(pages)) continue
      const kept: Record<string, number> = {}
      for (const [pageId, seconds] of Object.entries(pages)) {
        if (pageId !== '' && isAmount(seconds) && seconds > 0) kept[pageId] = seconds
      }
      if (Object.keys(kept).length > 0) days[date] = kept
    }
  }
  const sessions = Array.isArray(raw.sessions)
    ? raw.sessions
        .map(cleanSession)
        .filter((s): s is SessionEntry => s !== null)
        .slice(-MAX_SESSIONS)
    : []
  return { days, sessions }
}

export function addPractice(
  log: PracticeLog,
  date: string,
  pageId: string,
  seconds: number,
): PracticeLog {
  if (!(seconds > 0)) return log
  const day = log.days[date] ?? {}
  // Tenths of a second are plenty, and keep the stored JSON short.
  const total = Math.round(((day[pageId] ?? 0) + seconds) * 10) / 10
  return { ...log, days: { ...log.days, [date]: { ...day, [pageId]: total } } }
}

export function addSession(log: PracticeLog, entry: SessionEntry): PracticeLog {
  return { ...log, sessions: [...log.sessions, entry].slice(-MAX_SESSIONS) }
}
