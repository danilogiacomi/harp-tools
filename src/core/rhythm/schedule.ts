export interface TimeSignature {
  label: string
  beats: number
  unit: 4 | 8
}

export const TIME_SIGNATURES: readonly TimeSignature[] = [
  { label: '2/4', beats: 2, unit: 4 },
  { label: '3/4', beats: 3, unit: 4 },
  { label: '4/4', beats: 4, unit: 4 },
  { label: '6/8', beats: 6, unit: 8 },
  { label: '12/8', beats: 12, unit: 8 },
]

export type Subdivision = 1 | 2 | 3 | 4

export interface MetronomeConfig {
  /** Pulses per minute of the signature's unit (quarters in x/4, eighths in x/8). */
  bpm: number
  signature: TimeSignature
  subdivision: Subdivision
}

export type ClickKind = 'bar' | 'group' | 'beat' | 'sub'

export interface Click {
  /** AudioContext time in seconds. */
  time: number
  kind: ClickKind
  /** Pulse index within the bar. */
  pulse: number
}

export interface SchedulerState {
  nextTime: number
  pulse: number
  sub: number
}

export function accentKind(pulse: number, signature: TimeSignature): Exclude<ClickKind, 'sub'> {
  if (pulse === 0) return 'bar'
  // Compound time (6/8, 12/8) groups eighths in threes.
  if (signature.unit === 8 && pulse % 3 === 0) return 'group'
  return 'beat'
}

/** Clicks falling in [now, now + lookahead), plus the state to resume from next time. */
export function scheduleAhead(
  state: SchedulerState,
  config: MetronomeConfig,
  now: number,
  lookahead: number,
): { clicks: Click[]; state: SchedulerState } {
  let { nextTime, pulse, sub } = state
  const { beats } = config.signature

  // A throttled timer (background tab) can leave us behind: skip the missed clicks rather
  // than firing them all at once.
  if (nextTime < now) nextTime = now
  // The signature or subdivision may have shrunk since the last call.
  if (sub >= config.subdivision) {
    sub = 0
    pulse += 1
  }
  pulse %= beats

  const step = 60 / config.bpm / config.subdivision
  const clicks: Click[] = []
  while (nextTime < now + lookahead) {
    clicks.push({
      time: nextTime,
      kind: sub === 0 ? accentKind(pulse, config.signature) : 'sub',
      pulse,
    })
    sub += 1
    if (sub >= config.subdivision) {
      sub = 0
      pulse = (pulse + 1) % beats
    }
    nextTime += step
  }
  return { clicks, state: { nextTime, pulse, sub } }
}
