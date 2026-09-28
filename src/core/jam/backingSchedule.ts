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
}

/** Where the scheduler is: the next beat to schedule. */
export interface BackingState {
  /** AudioContext time in seconds. */
  nextBeatTime: number
  bar: number
  /** 0–3 within the bar. */
  beat: number
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
  // A throttled timer (background tab) can leave us behind: skip the missed beats rather than
  // playing them all at once.
  if (nextBeatTime < now) nextBeatTime = now
  bar %= config.form.length

  const beatS = 60 / config.bpm
  const offS = offbeatFraction(config.feel) * beatS
  const events: BackingEvent[] = []
  while (nextBeatTime < now + lookahead) {
    const t = nextBeatTime
    const root = chordRootPc(config.tonicPc, config.form[bar])
    if (beat === 0) events.push({ kind: 'bar', time: t, bar })
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

    beat += 1
    if (beat === BEATS_PER_BAR) {
      beat = 0
      bar = (bar + 1) % config.form.length
    }
    nextBeatTime += beatS
  }
  return { events, state: { nextBeatTime, bar, beat } }
}
