import { median } from '../stats'

/** How many recent beats the grid is fitted to. */
const KEEP = 8

/**
 * The metronome's beat grid on the page's clock, from the times its beats were heard. Each heard
 * beat arrives a few milliseconds late (a JS timer), so the grid's origin is the median over the
 * recent beats rather than the first one alone.
 */
export class BeatAnchor {
  private first: number | null = null
  private last: number | null = null
  private origins: number[] = []

  constructor(readonly periodMs: number) {}

  /** Feed each heard beat; repeats of the same time are ignored. The first beat is beat 0. */
  sync(beatMs: number): void {
    if (beatMs === this.last) return
    this.last = beatMs
    if (this.first === null) this.first = beatMs
    const index = Math.round((beatMs - this.first) / this.periodMs)
    this.origins.push(beatMs - index * this.periodMs)
    if (this.origins.length > KEEP) this.origins.shift()
  }

  /** The time of beat 0, or null before any beat was heard. */
  get originMs(): number | null {
    return this.origins.length > 0 ? median(this.origins) : null
  }

  /** The time of beat `index` (fractional beats allowed), or null before any beat was heard. */
  beatTime(index: number): number | null {
    const origin = this.originMs
    return origin === null ? null : origin + index * this.periodMs
  }
}
