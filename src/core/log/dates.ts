export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const DAY_MS = 86_400_000
const pad = (n: number) => String(n).padStart(2, '0')

/** The local calendar date of a timestamp, as `YYYY-MM-DD`. */
export function localDate(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Arithmetic on date strings goes through UTC midnight, so DST changes can't shift a day.
const toUtc = (date: string) => {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
const fromUtc = (ms: number) => {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * DAY_MS)
}

/** The Monday of `date`'s week. */
export function weekStart(date: string): string {
  const weekday = new Date(toUtc(date)).getUTCDay() // 0 = Sunday
  return addDays(date, -((weekday + 6) % 7))
}

/** A span of practice split at local midnights, in seconds per date. */
export function secondsByDay(startMs: number, endMs: number): { date: string; seconds: number }[] {
  const out: { date: string; seconds: number }[] = []
  let t = startMs
  while (t < endMs) {
    const d = new Date(t)
    const nextMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime()
    const end = Math.min(endMs, nextMidnight)
    out.push({ date: localDate(t), seconds: (end - t) / 1000 })
    t = end
  }
  return out
}
