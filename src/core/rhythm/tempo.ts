export const BPM_MIN = 30
export const BPM_MAX = 250

export function clampBpm(bpm: number): number {
  return Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(bpm)))
}

/** Tap tempo over the last `window` taps; a pause longer than `maxGapMs` starts over. */
export class TapTempo {
  private taps: number[] = []

  constructor(
    private readonly maxGapMs = 2000,
    private readonly window = 4,
  ) {}

  tap(nowMs: number): number | null {
    const last = this.taps.at(-1)
    if (last !== undefined && nowMs - last > this.maxGapMs) this.taps = []
    this.taps.push(nowMs)
    if (this.taps.length > this.window) this.taps.shift()
    if (this.taps.length < 2) return null
    const avgMs = (nowMs - this.taps[0]) / (this.taps.length - 1)
    return clampBpm(60000 / avgMs)
  }
}
