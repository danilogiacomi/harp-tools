/** How long after a prompt note stops the mic is still ignored (room echo, synth release). */
export const FEEDBACK_TAIL_MS = 150

/**
 * Spec §6.6: while the site plays a note the mic hears it too, so games ignore readings while
 * the NotePlayer is sounding and for a short tail after it stops.
 */
export class FeedbackGate {
  private sounding = false
  private endedAt = -Infinity

  constructor(private readonly tailMs = FEEDBACK_TAIL_MS) {}

  noteStarted(): void {
    this.sounding = true
  }

  noteEnded(timeMs: number): void {
    this.sounding = false
    this.endedAt = timeMs
  }

  accepts(timeMs: number): boolean {
    return !this.sounding && timeMs - this.endedAt >= this.tailMs
  }
}
