import { mean, median, stdDev } from '../stats'

/** One pitched mic reading: cents from the nearest note (`midi`) and the level in dBFS. */
export interface ToneSample {
  tMs: number
  cents: number
  midi: number
  db: number
}

export interface Vibrato {
  rateHz: number
  /** Peak-to-peak, in cents. */
  depthCents: number
}

export interface HoldStats {
  midi: number
  holdMs: number
  /** σ of cents: lower is steadier. */
  pitchSigma: number
  meanDb: number
  /** σ of dB: lower is steadier. */
  dbSigma: number
  /** False until the note has been held long enough to judge vibrato. */
  vibratoReady: boolean
  vibrato: Vibrato | null
}

/** Spec §8: a held note ends on a change of note or more than 150 ms without a reading. */
export const HOLD_BREAK_MS = 150
export const VIBRATO_MIN_HOLD_MS = 1000
export const VIBRATO_WINDOW_MS = 2000
export const VIBRATO_MIN_DEPTH = 8
export const VIBRATO_RATE_RANGE = [3, 9] as const
/** Cents the detrended pitch must swing past zero to count as a crossing (ignores jitter). */
const HYSTERESIS_CENTS = 2

/**
 * Rate and depth from the zero-crossings of the detrended cents over the last 2 s. Depth is
 * twice the median peak of the complete half-cycles, which a leftover trend or one noisy
 * reading barely moves.
 */
export function detectVibrato(samples: readonly ToneSample[]): Vibrato | null {
  const last = samples.at(-1)
  if (!last) return null
  const w = samples.filter((s) => s.tMs >= last.tMs - VIBRATO_WINDOW_MS)
  if (w.length < 8) return null

  // Least-squares line through (t, cents): the vibrato is what's left around it.
  const mt = mean(w.map((s) => s.tMs))
  const mc = mean(w.map((s) => s.cents))
  const den = w.reduce((sum, s) => sum + (s.tMs - mt) ** 2, 0)
  const slope = den === 0 ? 0 : w.reduce((sum, s) => sum + (s.tMs - mt) * (s.cents - mc), 0) / den
  const residual = w.map((s) => s.cents - (mc + slope * (s.tMs - mt)))

  const crossings: number[] = []
  const peaks: number[] = []
  let side = 0
  let peak = 0
  residual.forEach((r, i) => {
    const now = r > HYSTERESIS_CENTS ? 1 : r < -HYSTERESIS_CENTS ? -1 : 0
    if (now !== 0 && now !== side) {
      // The half-cycle before the first crossing is partial: only later ones count.
      if (side !== 0) {
        if (crossings.length > 0) peaks.push(peak)
        crossings.push(w[i].tMs)
      }
      side = now
      peak = 0
    }
    peak = Math.max(peak, Math.abs(r))
  })
  if (crossings.length < 3) return null
  const spanS = (crossings[crossings.length - 1] - crossings[0]) / 1000
  const rateHz = (crossings.length - 1) / 2 / spanS
  const depthCents = 2 * median(peaks)
  const [lo, hi] = VIBRATO_RATE_RANGE
  if (depthCents < VIBRATO_MIN_DEPTH || rateHz < lo || rateHz > hi) return null
  return { rateHz, depthCents }
}

/** Stats of one held note (all samples share a MIDI note). */
export function analyzeHold(samples: readonly ToneSample[]): HoldStats | null {
  const first = samples[0]
  const last = samples.at(-1)
  if (!first || !last) return null
  const holdMs = last.tMs - first.tMs
  const vibratoReady = holdMs >= VIBRATO_MIN_HOLD_MS
  return {
    midi: first.midi,
    holdMs,
    pitchSigma: stdDev(samples.map((s) => s.cents)),
    meanDb: mean(samples.map((s) => s.db)),
    dbSigma: stdDev(samples.map((s) => s.db)),
    vibratoReady,
    vibrato: vibratoReady ? detectVibrato(samples) : null,
  }
}

/** Collects the samples of the current held note; the last hold stays until a new one starts. */
export class HoldTracker {
  private samples: ToneSample[] = []

  push(sample: ToneSample): void {
    const last = this.samples.at(-1)
    if (!last || last.midi !== sample.midi || sample.tMs - last.tMs > HOLD_BREAK_MS) {
      this.samples = []
    }
    this.samples.push(sample)
  }

  get hold(): readonly ToneSample[] {
    return this.samples
  }

  /** True while the note is still sounding at `nowMs`. */
  isActive(nowMs: number): boolean {
    const last = this.samples.at(-1)
    return last !== undefined && nowMs - last.tMs <= HOLD_BREAK_MS
  }
}
