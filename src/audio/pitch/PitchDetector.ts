import type { MicErrorKind } from '../Microphone'

export interface PitchReading {
  freq: number
  clarity: number
  rms: number
}

/** `rms` is always reported, even when the reading is gated to null, for level meters. */
export type PitchListener = (reading: PitchReading | null, rms: number) => void

export interface PitchDetector {
  /** Resolves once the mic is open; rejects with MicrophoneError. */
  start(): Promise<void>
  stop(): void
  onPitch(listener: PitchListener): () => void
  /** Errors after start() resolved, e.g. 'no-device' when the mic is unplugged; detection stops. */
  onError(listener: (kind: MicErrorKind) => void): () => void
}
