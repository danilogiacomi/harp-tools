/** Plays reference notes. SynthNotePlayer now; a sample-based player can replace it later. */
export interface NotePlayer {
  /** Plays for `durationMs` (default 1000); resolves when the note ends. */
  play(midi: number, opts?: { durationMs?: number }): Promise<void>
  /** Sustains until stop(). Starting a new note stops the previous one. */
  start(midi: number): void
  stop(): void
  readonly isSounding: boolean
  /**
   * Fires true when the player starts sounding and false when it stops. Replacing one note with
   * another doesn't fire. Games use it to ignore the mic while their prompt plays (spec §6.6).
   */
  onSoundingChange(listener: (sounding: boolean) => void): () => void
}
