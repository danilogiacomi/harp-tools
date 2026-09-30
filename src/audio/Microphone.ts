import { audioEngine } from './AudioEngine'
import { screenAwake, type KeepAwake } from './screenAwake'

export type MicErrorKind = 'insecure' | 'denied' | 'no-device' | 'busy' | 'unknown'

export class MicrophoneError extends Error {
  constructor(readonly kind: MicErrorKind) {
    super(`Microphone unavailable: ${kind}`)
    this.name = 'MicrophoneError'
  }
}

export function mapMicError(error: unknown): MicErrorKind {
  const name =
    typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'denied'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'no-device'
    case 'NotReadableError':
    case 'AbortError':
      return 'busy'
    default:
      return 'unknown'
  }
}

const FFT_SIZE = 2048

/** Shared, reference-counted mic input: opened on first acquire(), closed on last release(). */
export class Microphone {
  private stream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private pending: Promise<AnalyserNode> | null = null
  private users = 0
  private endedListeners = new Set<() => void>()
  private releaseScreen: (() => void) | null = null

  constructor(private readonly awake: KeepAwake = screenAwake) {}

  async acquire(): Promise<AnalyserNode> {
    if (!navigator.mediaDevices?.getUserMedia) throw new MicrophoneError('insecure')
    this.users++
    try {
      return await (this.pending ??= this.open())
    } catch (e) {
      this.users = Math.max(0, this.users - 1)
      this.pending = null
      throw e
    }
  }

  release(): void {
    if (this.users === 0) return
    this.users--
    if (this.users > 0) return
    this.close()
  }

  /** Fires when the open mic stops on its own (device unplugged, permission revoked). */
  onEnded(listener: () => void): () => void {
    this.endedListeners.add(listener)
    return () => {
      this.endedListeners.delete(listener)
    }
  }

  private async open(): Promise<AnalyserNode> {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        // Browser voice processing distorts a harmonica's tone and confuses pitch detection.
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
    } catch (e) {
      throw new MicrophoneError(mapMicError(e))
    }
    if (this.users === 0) {
      // Everyone released while the permission prompt was open.
      stream.getTracks().forEach((t) => t.stop())
      throw new MicrophoneError('unknown')
    }
    let analyser: AnalyserNode
    try {
      const ctx = audioEngine.ctx
      const source = ctx.createMediaStreamSource(stream)
      analyser = ctx.createAnalyser()
      analyser.fftSize = FFT_SIZE
      source.connect(analyser)
      this.source = source
    } catch {
      stream.getTracks().forEach((t) => t.stop())
      throw new MicrophoneError('unknown')
    }
    this.stream = stream
    this.releaseScreen = this.awake.hold()
    stream.getTracks().forEach((t) => t.addEventListener('ended', () => this.ended(stream)))
    return analyser
  }

  private ended(stream: MediaStream): void {
    if (stream !== this.stream) return
    // Current users are told via onEnded; their later release() calls become no-ops.
    this.users = 0
    this.close()
    this.endedListeners.forEach((l) => l())
  }

  private close(): void {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.source?.disconnect()
    this.stream = null
    this.source = null
    this.pending = null
    this.releaseScreen?.()
    this.releaseScreen = null
  }
}

export const microphone = new Microphone()
