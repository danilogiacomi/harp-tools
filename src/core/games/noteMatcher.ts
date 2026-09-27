import { centsOff } from '../music/pitch'

export interface MatcherConfig {
  /** How far from the target (either way) still counts as the note. */
  toleranceCents: number
  /** How long the note must be held in tolerance. */
  holdMs: number
}

export interface MatchState {
  /** 0–1: share of the hold time held so far. */
  progress: number
  matched: boolean
  /** The latest reading was within tolerance. */
  inTune: boolean
  /** Cents from the target of the latest reading; null for silence. */
  cents: number | null
  /** When the current (or completed) hold began; null when not holding. */
  holdStartMs: number | null
}

const EMPTY: MatchState = {
  progress: 0,
  matched: false,
  inTune: false,
  cents: null,
  holdStartMs: null,
}

/** Decides when a stream of timestamped pitch readings has held `target` long enough. */
export class NoteMatcher {
  private holdStart: number | null = null
  private samples: number[] = []
  private current: MatchState = EMPTY

  constructor(
    readonly target: number,
    private readonly config: MatcherConfig,
    private readonly a4 = 440,
  ) {}

  get state(): MatchState {
    return this.current
  }

  /** Cents of each reading in the current (or completed) hold. */
  get holdCents(): readonly number[] {
    return this.samples
  }

  push(freq: number | null, timeMs: number): MatchState {
    if (this.current.matched) return this.current
    const cents = freq === null ? null : centsOff(freq, this.target, this.a4)
    if (cents === null || Math.abs(cents) > this.config.toleranceCents) {
      this.holdStart = null
      this.samples = []
      this.current = { ...EMPTY, cents }
      return this.current
    }
    if (this.holdStart === null) this.holdStart = timeMs
    this.samples.push(cents)
    const held = timeMs - this.holdStart
    this.current = {
      progress: Math.min(1, held / this.config.holdMs),
      matched: held >= this.config.holdMs,
      inTune: true,
      cents,
      holdStartMs: this.holdStart,
    }
    return this.current
  }
}

/** 1 for a perfectly steady hold, falling to 0 as the spread reaches the tolerance. */
export function stabilityScore(cents: readonly number[], toleranceCents: number): number {
  if (cents.length === 0) return 0
  const mean = cents.reduce((a, b) => a + b, 0) / cents.length
  const variance = cents.reduce((a, c) => a + (c - mean) ** 2, 0) / cents.length
  return Math.max(0, 1 - Math.sqrt(variance) / toleranceCents)
}
