import type { NotePlayer } from './NotePlayer'

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

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

  cancel = (): void => {
    this.generation++
    this.player.stop()
  }
}
