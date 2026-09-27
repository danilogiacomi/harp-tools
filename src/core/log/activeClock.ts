export interface Span {
  readonly startMs: number
  readonly endMs: number
}

/** A span longer than this means the computer slept or the clock jumped (flushes are 15 s). */
export const MAX_SPAN_MS = 30_000

/** Accumulates "active" time; the practice timer flushes it into the log as spans. */
export class ActiveClock {
  private since: number | null = null

  get running(): boolean {
    return this.since !== null
  }

  start(nowMs: number): void {
    if (this.since === null) this.since = nowMs
  }

  /** The time since the last flush (at most MAX_SPAN_MS); keeps running from `nowMs`. */
  flush(nowMs: number): Span | null {
    if (this.since === null) return null
    const from = this.since
    this.since = nowMs
    if (nowMs <= from) return null
    return { startMs: Math.max(from, nowMs - MAX_SPAN_MS), endMs: nowMs }
  }

  stop(nowMs: number): Span | null {
    const span = this.flush(nowMs)
    this.since = null
    return span
  }
}
