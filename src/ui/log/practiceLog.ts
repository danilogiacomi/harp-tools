import { localDate, secondsByDay } from '../../core/log/dates'
import {
  addPractice,
  addSession,
  emptyLog,
  sanitizeLog,
  type PracticeLog,
  type SessionEntry,
} from '../../core/log/logModel'

export const LOG_KEY = 'harp-tools:log'

export function loadLog(storage: Pick<Storage, 'getItem'> | null): PracticeLog {
  try {
    const text = storage?.getItem(LOG_KEY)
    return text ? sanitizeLog(JSON.parse(text)) : emptyLog()
  } catch {
    return emptyLog()
  }
}

/** False when there is no storage or the write failed (full or blocked). */
export function saveLog(storage: Pick<Storage, 'setItem'> | null, log: PracticeLog): boolean {
  if (!storage) return false
  try {
    storage.setItem(LOG_KEY, JSON.stringify(log))
    return true
  } catch {
    return false
  }
}

/** Adds a span of practice on `pageId`, split at local midnight (spec §5). */
export function recordPractice(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
  pageId: string,
  startMs: number,
  endMs: number,
): void {
  const pieces = secondsByDay(startMs, endMs)
  if (!storage || pieces.length === 0) return
  let log = loadLog(storage)
  for (const { date, seconds } of pieces) log = addPractice(log, date, pageId, seconds)
  saveLog(storage, log)
}

/** Logs a finished scored session, dated by the local day of `nowMs`. */
export function appendSession(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
  entry: Omit<SessionEntry, 'date'>,
  nowMs: number,
): void {
  if (!storage) return
  saveLog(storage, addSession(loadLog(storage), { date: localDate(nowMs), ...entry }))
}

export function clearLog(storage: Pick<Storage, 'removeItem'> | null): void {
  try {
    storage?.removeItem(LOG_KEY)
  } catch {
    // Blocked storage: there is nothing we can clear.
  }
}
