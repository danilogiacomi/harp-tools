/** A chart point: null values break the line (silence). */
export interface TonePoint {
  tMs: number
  cents: number | null
  db: number | null
}

/** Spec §8: the chart rolls over the last 6 seconds. */
export const HISTORY_MS = 6000

/** The last 6 s of readings, oldest first; older points are dropped as new ones arrive. */
export class ToneHistory {
  private items: TonePoint[] = []

  constructor(private readonly windowMs = HISTORY_MS) {}

  push(point: TonePoint): void {
    this.items.push(point)
    const cutoff = point.tMs - this.windowMs
    let drop = 0
    while (drop < this.items.length && this.items[drop].tMs < cutoff) drop++
    if (drop > 0) this.items.splice(0, drop)
  }

  get points(): readonly TonePoint[] {
    return this.items
  }
}

export interface TraceBox {
  nowMs: number
  windowMs: number
  width: number
  height: number
  /** Value range drawn bottom to top; values outside are clamped to the edge. */
  range: readonly [number, number]
}

/** An SVG path for one series: x runs from `nowMs − windowMs` (left) to `nowMs` (right). */
export function tracePath(
  points: readonly TonePoint[],
  series: 'cents' | 'db',
  box: TraceBox,
): string {
  const [lo, hi] = box.range
  const parts: string[] = []
  let pen = false
  for (const p of points) {
    const v = p[series]
    const age = box.nowMs - p.tMs
    if (v === null || age > box.windowMs || age < 0) {
      pen = false
      continue
    }
    const x = box.width * (1 - age / box.windowMs)
    const clamped = Math.min(hi, Math.max(lo, v))
    const y = box.height * (1 - (clamped - lo) / (hi - lo))
    parts.push(`${pen ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`)
    pen = true
  }
  return parts.join(' ')
}
