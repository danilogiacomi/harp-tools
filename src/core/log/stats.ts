import { addDays, weekStart } from './dates'
import type { PracticeLog, SessionEntry } from './logModel'

/** Spec §5: a day counts towards a streak with at least this much practice. */
export const STREAK_MIN_SECONDS = 60

export function dayTotal(log: PracticeLog, date: string): number {
  return Object.values(log.days[date] ?? {}).reduce((sum, s) => sum + s, 0)
}

const practised = (log: PracticeLog, date: string) => dayTotal(log, date) >= STREAK_MIN_SECONDS

/** Current streak ends today or yesterday (today isn't over); longest is the best run ever. */
export function streaks(log: PracticeLog, today: string): { current: number; longest: number } {
  let current = 0
  let day = practised(log, today) ? today : addDays(today, -1)
  while (practised(log, day)) {
    current++
    day = addDays(day, -1)
  }

  let longest = 0
  let run = 0
  let previous: string | null = null
  const dates = Object.keys(log.days)
    .filter((d) => practised(log, d))
    .sort()
  for (const date of dates) {
    run = previous !== null && addDays(previous, 1) === date ? run + 1 : 1
    longest = Math.max(longest, run)
    previous = date
  }
  return { current, longest }
}

const inThisWeek = (date: string, today: string) => date >= weekStart(today) && date <= today

export function totals(
  log: PracticeLog,
  today: string,
): { today: number; week: number; all: number } {
  let week = 0
  let all = 0
  for (const date of Object.keys(log.days)) {
    const total = dayTotal(log, date)
    all += total
    if (inThisWeek(date, today)) week += total
  }
  return { today: dayTotal(log, today), week, all }
}

/** The last `count` days up to today, oldest first. */
export function dailySeconds(
  log: PracticeLog,
  today: string,
  count = 14,
): { date: string; seconds: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(today, i - count + 1)
    return { date, seconds: dayTotal(log, date) }
  })
}

export function pageSecondsThisWeek(
  log: PracticeLog,
  today: string,
): { pageId: string; seconds: number }[] {
  const byPage = new Map<string, number>()
  for (const [date, pages] of Object.entries(log.days)) {
    if (!inThisWeek(date, today)) continue
    for (const [pageId, seconds] of Object.entries(pages)) {
      byPage.set(pageId, (byPage.get(pageId) ?? 0) + seconds)
    }
  }
  return [...byPage]
    .map(([pageId, seconds]) => ({ pageId, seconds }))
    .sort((a, b) => b.seconds - a.seconds || a.pageId.localeCompare(b.pageId))
}

export function recentSessions(log: PracticeLog, count = 10): SessionEntry[] {
  return log.sessions.slice(-count).reverse()
}

/** "45 s", "12 min", "1 h 05 min". */
export function formatDuration(seconds: number): string {
  const s = Math.round(seconds)
  if (s < 60) return `${s} s`
  const minutes = Math.floor(s / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`
}
