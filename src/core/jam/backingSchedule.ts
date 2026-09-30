import { chordRootPc, DOMINANT_7TH, type Degree } from './blues'

export type Feel = 'shuffle' | 'straight'
export type Instrument = 'kick' | 'snare' | 'hat' | 'bass' | 'chords'
export const INSTRUMENTS: readonly Instrument[] = ['kick', 'snare', 'hat', 'bass', 'chords']

export interface BackingConfig {
  bpm: number
  feel: Feel
  form: readonly Degree[]
  /** The tonic of the I chord. */
  tonicPc: number
  /** Bars of hi-hat alone before the form, numbered -countInBars … -1 (default 0). */
  countInBars?: number
  /**
   * Repeat the form forever (default). False plays it once, then reports the end once as a
   * `bar` event numbered `form.length`, and schedules nothing more.
   */
  loop?: boolean
}

/** Where the scheduler is: the next beat to schedule. */
export interface BackingState {
  /** AudioContext time in seconds. */
  nextBeatTime: number
  /** Negative in the count-in; past form.length once a song that doesn't loop has ended. */
  bar: number
  /** 0–3 within the bar. */
  beat: number
}

/** A backing that starts at `time`: from its first count-in bar, or bar 0. */
export function initialBackingState(config: BackingConfig, time: number): BackingState {
  return { nextBeatTime: time, bar: 0 - (config.countInBars ?? 0), beat: 0 }
}

export type BackingEvent =
  | { kind: 'kick' | 'snare' | 'hat'; time: number }
  | { kind: 'bass'; time: number; midi: number; duration: number }
  | { kind: 'chords'; time: number; midis: number[]; duration: number }
  /** A new bar starts: the page shows its chord. */
  | { kind: 'bar'; time: number; bar: number }

export const BEATS_PER_BAR = 4
/** Spec §12: shuffle swings the eighths 2:1, so the offbeat falls 2/3 of the way through a beat. */
export function offbeatFraction(feel: Feel): number {
  return feel === 'shuffle' ? 2 / 3 : 1 / 2
}

/** Walking shuffle bass per chord, in eighths: root–3rd–5th–6th–♭7th–6th–5th–3rd. */
export const SHUFFLE_BASS = [0, 4, 7, 9, 10, 9, 7, 4] as const
/** On the straight feel, simplified to quarters: the pattern's climb, root–3rd–5th–6th. */
export const STRAIGHT_BASS = [0, 4, 7, 9] as const
/** How long a chord stab sounds, in seconds. */
export const STAB_S = 0.12
/** Notes sound for this share of their slot, so repeated notes stay distinct. */
const GATE = 0.9

/** The bass root sits in C2–B2. */
export function bassMidi(rootPc: number, semitones: number): number {
  return 36 + rootPc + semitones
}

/** A close dominant-7th voicing with its root in E3–D#4. */
export function chordMidis(rootPc: number): number[] {
  const root = 52 + ((rootPc - 4 + 12) % 12)
  return DOMINANT_7TH.map((i) => root + i)
}

/**
 * Events for every beat starting in [now, now + lookahead), and the state to resume from: the
 * metronome's look-ahead pattern, one beat at a time. Config changes apply from the next beat.
 */
export function scheduleBacking(
  state: BackingState,
  config: BackingConfig,
  now: number,
  lookahead: number,
): { events: BackingEvent[]; state: BackingState } {
  let { nextBeatTime, bar, beat } = state
  const loop = config.loop ?? true
  const end = config.form.length
  const beatS = 60 / config.bpm
  const offS = offbeatFraction(config.feel) * beatS
  const advance = () => {
    beat += 1
    if (beat === BEATS_PER_BAR) {
      beat = 0
      bar += 1
      if (loop && bar === end) bar = 0
    }
    nextBeatTime += beatS
  }
  if (loop && bar >= end) bar %= end
  // A throttled timer (background tab) can leave us behind: skip the missed beats rather than
  // playing them all at once, staying on the beat grid (a song's clock is anchored to it).
  while (nextBeatTime < now && bar < end) advance()

  const events: BackingEvent[] = []
  while (nextBeatTime < now + lookahead) {
    const t = nextBeatTime
    if (bar >= end) {
      // A song that doesn't loop: report its end once, then schedule nothing more.
      if (bar === end) events.push({ kind: 'bar', time: t, bar })
      bar = end + 1
      break
    }
    if (beat === 0) events.push({ kind: 'bar', time: t, bar })
    if (bar < 0) {
      // The count-in: the hi-hat alone, on the beat.
      events.push({ kind: 'hat', time: t })
      advance()
      continue
    }
    const root = chordRootPc(config.tonicPc, config.form[bar])
    events.push({ kind: beat % 2 === 0 ? 'kick' : 'snare', time: t })
    events.push({ kind: 'hat', time: t }, { kind: 'hat', time: t + offS })
    if (config.feel === 'shuffle') {
      events.push(
        {
          kind: 'bass',
          time: t,
          midi: bassMidi(root, SHUFFLE_BASS[beat * 2]),
          duration: offS * GATE,
        },
        {
          kind: 'bass',
          time: t + offS,
          midi: bassMidi(root, SHUFFLE_BASS[beat * 2 + 1]),
          duration: (beatS - offS) * GATE,
        },
      )
    } else {
      events.push({
        kind: 'bass',
        time: t,
        midi: bassMidi(root, STRAIGHT_BASS[beat]),
        duration: beatS * GATE,
      })
    }
    events.push({ kind: 'chords', time: t + offS, midis: chordMidis(root), duration: STAB_S })
    advance()
  }
  return { events, state: { nextBeatTime, bar, beat } }
}
