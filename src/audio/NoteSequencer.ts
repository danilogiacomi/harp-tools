import type { NotePlayer } from './NotePlayer'

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** One step of a timed prompt: a note, or a rest when `midi` is null. `ms` is its full length. */
export interface TimedPrompt {
  midi: number | null
  ms: number
}

/** Share of a timed note that sounds; the rest is silence, so repeated notes are heard apart. */
export const LEGATO = 0.9

/** Plays prompt notes one after another. A new play() or cancel() abandons the running one. */
export class NoteSequencer {
  private generation = 0

  constructor(
    private readonly player: NotePlayer,
    private readonly wait: (ms: number) => Promise<void> = sleep,
  ) {}

  /** Resolves true when every note played, false if cancelled or superseded. */
  play = async (midis: readonly number[], noteMs = 700, gapMs = 120): Promise<boolean> => {
    const generation = ++this.generation
    for (let i = 0; i < midis.length; i++) {
      if (i > 0) await this.wait(gapMs)
      if (generation !== this.generation) return false
      await this.player.play(midis[i], { durationMs: noteMs })
      if (generation !== this.generation) return false
    }
    return true
  }

  /** Plays notes and rests with their own lengths (a lick at tempo). Resolves like play(). */
  playTimed = async (notes: readonly TimedPrompt[]): Promise<boolean> => {
    const generation = ++this.generation
    for (const n of notes) {
      if (n.midi === null) {
        await this.wait(n.ms)
      } else {
        const soundMs = n.ms * LEGATO
        await this.player.play(n.midi, { durationMs: soundMs })
        if (generation !== this.generation) return false
        await this.wait(n.ms - soundMs)
      }
      if (generation !== this.generation) return false
    }
    return true
  }

  cancel = (): void => {
    this.generation++
    this.player.stop()
  }
}
