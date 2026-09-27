import { NoteMatcher, stabilityScore, type MatcherConfig } from './noteMatcher'

export type ListenStatus = 'listening' | 'hit' | 'timeout'

export interface ListenRoundConfig {
  matcher: MatcherConfig
  a4: number
  /** Scored rounds end as a miss after this long; null = untimed. */
  limitMs: number | null
  /** Offer help after this much wrong playing; null = never. */
  helpAfterMs: number | null
}

export interface ListenRoundState {
  status: ListenStatus
  progress: number
  cents: number | null
  elapsedMs: number
  helpOffered: boolean
  /** Time from the round start to the completed hold (hit only). */
  timeMs: number | null
  /** 0–1 steadiness of the completed hold (hit only). */
  stability: number | null
}

/** Readings arrive every animation frame; a longer gap (background tab) counts as this much. */
const MAX_FRAME_GAP_MS = 100

/** One "play and hold this pitch" round. Feed it every mic frame, gated frames as null. */
export class ListenRound {
  private readonly matcher: NoteMatcher
  private lastMs: number | null = null
  private wrongMs = 0
  private current: ListenRoundState = {
    status: 'listening',
    progress: 0,
    cents: null,
    elapsedMs: 0,
    helpOffered: false,
    timeMs: null,
    stability: null,
  }

  constructor(
    readonly target: number,
    private readonly config: ListenRoundConfig,
    private readonly startMs: number,
  ) {
    this.matcher = new NoteMatcher(target, config.matcher, config.a4)
  }

  get state(): ListenRoundState {
    return this.current
  }

  push(freq: number | null, timeMs: number): ListenRoundState {
    if (this.current.status !== 'listening') return this.current
    const m = this.matcher.push(freq, timeMs)
    const dt =
      this.lastMs === null ? 0 : Math.min(MAX_FRAME_GAP_MS, Math.max(0, timeMs - this.lastMs))
    this.lastMs = timeMs
    if (freq !== null && !m.inTune) this.wrongMs += dt

    const { helpAfterMs, limitMs } = this.config
    const elapsedMs = timeMs - this.startMs
    const helpOffered =
      this.current.helpOffered || (helpAfterMs !== null && this.wrongMs >= helpAfterMs)
    let status: ListenStatus = 'listening'
    if (m.matched) status = 'hit'
    else if (limitMs !== null && elapsedMs >= limitMs) status = 'timeout'

    this.current = {
      status,
      progress: m.progress,
      cents: m.cents,
      elapsedMs,
      helpOffered,
      timeMs: status === 'hit' ? elapsedMs : null,
      stability:
        status === 'hit'
          ? stabilityScore(this.matcher.holdCents, this.config.matcher.toleranceCents)
          : null,
    }
    return this.current
  }
}
