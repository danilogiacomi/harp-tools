import { audioEngine } from './AudioEngine'

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
    const ctx = audioEngine.ctx
    this.stream = stream
    this.source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = FFT_SIZE
    this.source.connect(analyser)
    return analyser
  }

  private close(): void {
    this.stream?.getTracks().forEach((t) => t.stop())
    this.source?.disconnect()
    this.stream = null
    this.source = null
    this.pending = null
  }
}

export const microphone = new Microphone()
