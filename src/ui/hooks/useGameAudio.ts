import { useEffect, useState } from 'react'
import type { MicErrorKind } from '../../audio/Microphone'
import type { NotePlayer } from '../../audio/NotePlayer'
import { NoteSequencer, type TimedPrompt } from '../../audio/NoteSequencer'
import type { PitchReading } from '../../audio/pitch/PitchDetector'
import { FeedbackGate } from '../../core/games/feedbackGate'
import { freqToMidi } from '../../core/music/pitch'
import { useSettings } from '../settings/SettingsContext'
import { useNotePlayer } from './useNotePlayer'
import { usePitch, type PitchStatus } from './usePitch'

/** `freq` is null for silence and for frames ignored by the feedback gate. */
export type HeardListener = (freq: number | null, timeMs: number) => void

export interface GameAudio {
  player: NotePlayer
  status: PitchStatus
  error: MicErrorKind | null
  /** Nearest MIDI note of the latest accepted reading, for the diagram's "detected" state. */
  detectedMidi: number | null
  /** The clock the listener's timestamps use; call it from handlers, never during render. */
  now: () => number
  /**
   * Registers the function that receives every gated frame; returns its unregister. Call it
   * from an effect.
   */
  listen: (listener: HeardListener) => () => void
  playSequence: (midis: readonly number[], noteMs?: number, gapMs?: number) => Promise<boolean>
  /** Plays notes and rests with their own lengths; resolves false if cancelled or superseded. */
  playTimed: (notes: readonly TimedPrompt[]) => Promise<boolean>
  cancelPlayback: () => void
}

const now = () => performance.now()

/** Routes gated mic frames to the page's latest listener. Lives in useState, not a ref. */
class HeardRouter {
  private listener: HeardListener = () => {}
  private a4 = 440
  private lastMidi: number | null = null
  private readonly gate = new FeedbackGate()

  constructor(private readonly onDetected: (midi: number | null) => void) {}

  listen = (listener: HeardListener): (() => void) => {
    this.listener = listener
    return () => {
      if (this.listener === listener) this.listener = () => {}
    }
  }

  setA4(a4: number): void {
    this.a4 = a4
  }

  reading = (reading: PitchReading | null): void => {
    const t = now()
    const freq = reading && this.gate.accepts(t) ? reading.freq : null
    const midi = freq === null ? null : freqToMidi(freq, this.a4).midi
    if (midi !== this.lastMidi) {
      this.lastMidi = midi
      this.onDetected(midi)
    }
    this.listener(freq, t)
  }

  soundingChanged = (sounding: boolean): void => {
    if (sounding) this.gate.noteStarted()
    else this.gate.noteEnded(now())
  }
}

/**
 * The only way games hear the mic (spec §6.6): readings are dropped while the prompt player
 * sounds and for 150 ms after, so the site never answers its own question.
 */
export function useGameAudio(listening: boolean): GameAudio {
  const { settings } = useSettings()
  const player = useNotePlayer()
  const [detectedMidi, setDetectedMidi] = useState<number | null>(null)
  const [router] = useState(() => new HeardRouter(setDetectedMidi))
  const [sequencer] = useState(() => new NoteSequencer(player))

  useEffect(() => router.setA4(settings.a4), [router, settings.a4])
  useEffect(() => player.onSoundingChange(router.soundingChanged), [player, router])
  useEffect(() => () => sequencer.cancel(), [sequencer])

  const pitch = usePitch(listening, router.reading)

  return {
    player,
    status: pitch.status,
    error: pitch.error,
    detectedMidi: listening ? detectedMidi : null,
    now,
    listen: router.listen,
    playSequence: sequencer.play,
    playTimed: sequencer.playTimed,
    cancelPlayback: sequencer.cancel,
  }
}
