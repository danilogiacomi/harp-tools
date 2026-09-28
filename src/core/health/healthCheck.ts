import type { HarpNote, Hole } from '../harmonica/harp'
import { centsOff } from '../music/pitch'
import { mean, median } from '../stats'

export interface Reed {
  hole: Hole
  technique: 'blow' | 'draw'
  midi: number
}

/** The 20 unbent reeds in check order: hole 1 blow, hole 1 draw … hole 10 draw. */
export function healthReeds(harp: readonly HarpNote[]): Reed[] {
  const reeds: Reed[] = []
  for (let hole = 1; hole <= 10; hole++) {
    for (const technique of ['blow', 'draw'] as const) {
      const n = harp.find((x) => x.hole === hole && x.technique === technique)
      if (n) reeds.push({ hole: n.hole, technique, midi: n.midi })
    }
  }
  return reeds
}

/** Spec §7: a reed is measured after 1 s of continuous readings within ±60 cents. */
export const STEADY_MS = 1000
export const WINDOW_CENTS = 60
/** A dropped frame or two (shorter than this) doesn't break the second. */
export const MAX_GAP_MS = 100

export type MeasureStatus = 'waiting' | 'measuring' | 'done'

export interface MeasureState {
  status: MeasureStatus
  /** 0–1 share of the steady second held so far. */
  progress: number
  /** Cents from the reed's note of the latest reading; null for silence. */
  cents: number | null
  /** The median cents of the steady second, once done. */
  result: number | null
}

/** Measures one reed from a stream of timestamped readings (null = silence). */
export class ReedMeasure {
  private run: number[] = []
  private runStart: number | null = null
  private lastInWindow: number | null = null
  private current: MeasureState = { status: 'waiting', progress: 0, cents: null, result: null }
  private heardSilence: boolean

  /**
   * With `afterSilence`, readings only count once the mic has heard silence: neighbouring reeds
   * can share a pitch (2 draw and 3 blow are both G on a Richter harp), so the note that
   * finished the previous reed must stop before this one is measured.
   */
  constructor(
    readonly midi: number,
    readonly a4 = 440,
    { afterSilence = false }: { afterSilence?: boolean } = {},
  ) {
    this.heardSilence = !afterSilence
  }

  get state(): MeasureState {
    return this.current
  }

  push(freq: number | null, timeMs: number): MeasureState {
    if (this.current.status === 'done') return this.current
    if (freq === null) this.heardSilence = true
    if (!this.heardSilence) return this.current
    const cents = freq === null ? null : centsOff(freq, this.midi, this.a4)
    const gapTooLong = this.lastInWindow !== null && timeMs - this.lastInWindow > MAX_GAP_MS

    if (cents !== null && Math.abs(cents) <= WINDOW_CENTS) {
      if (this.runStart === null || gapTooLong) {
        this.runStart = timeMs
        this.run = []
      }
      this.run.push(cents)
      this.lastInWindow = timeMs
      const held = timeMs - this.runStart
      this.current =
        held >= STEADY_MS
          ? { status: 'done', progress: 1, cents, result: median(this.run) }
          : { status: 'measuring', progress: held / STEADY_MS, cents, result: null }
      return this.current
    }

    if (cents !== null || gapTooLong) this.reset()
    this.current =
      this.runStart === null
        ? { status: 'waiting', progress: 0, cents, result: null }
        : { ...this.current, cents }
    return this.current
  }

  private reset(): void {
    this.run = []
    this.runStart = null
    this.lastInWindow = null
  }
}

/** Cents measured against A4 = `fromA4`, re-read against `toA4`. */
export function centsAtA4(cents: number, fromA4: number, toA4: number): number {
  return cents + 1200 * Math.log2(fromA4 / toA4)
}

export interface ReedResult extends Reed {
  /** Median cents off; null when the reed was skipped. */
  cents: number | null
}

export interface HealthSummary {
  measured: number
  averageCents: number | null
  /** Up to three reeds more than 10 cents off, worst first. */
  worst: ReedResult[]
  /** An A4 setting that matches the harp's overall offset, when it clearly differs. */
  suggestedA4: number | null
}

/** Below this many measured reeds the average says little about the harp. */
export const SUGGEST_MIN_REEDS = 5
/** An average offset this large (≈ 442 Hz against 440) suggests another reference pitch. */
export const SUGGEST_MIN_CENTS = 5

export function summarizeHealth(
  results: readonly ReedResult[],
  a4: number,
  a4Range: readonly [number, number],
): HealthSummary {
  const measured = results.filter((r): r is ReedResult & { cents: number } => r.cents !== null)
  if (measured.length === 0)
    return { measured: 0, averageCents: null, worst: [], suggestedA4: null }
  const averageCents = mean(measured.map((r) => r.cents))
  const worst = measured
    .filter((r) => Math.abs(r.cents) > 10)
    .sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents))
    .slice(0, 3)
  let suggestedA4: number | null = null
  if (measured.length >= SUGGEST_MIN_REEDS && Math.abs(averageCents) >= SUGGEST_MIN_CENTS) {
    const hz = Math.round(a4 * 2 ** (averageCents / 1200))
    const clamped = Math.min(a4Range[1], Math.max(a4Range[0], hz))
    if (clamped !== a4) suggestedA4 = clamped
  }
  return { measured: measured.length, averageCents, worst, suggestedA4 }
}
