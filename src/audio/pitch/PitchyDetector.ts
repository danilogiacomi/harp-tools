import { PitchDetector as Mpm } from 'pitchy'
import { microphone, type MicErrorKind } from '../Microphone'
import { MedianSmoother, analyzeFrame, type GateOptions } from './analysis'
import type { PitchDetector, PitchListener } from './PitchDetector'

/** Reads the shared mic on every animation frame and runs pitchy (McLeod) on it. */
export class PitchyDetector implements PitchDetector {
  private listeners = new Set<PitchListener>()
  private errorListeners = new Set<(kind: MicErrorKind) => void>()
  private smoother = new MedianSmoother(3)
  private frame = 0
  private running = false
  private acquired = false
  /** Bumped by every start()/stop(), so a stale acquire() can tell it has been superseded. */
  private generation = 0
  private offEnded: (() => void) | null = null

  constructor(private readonly gate: () => GateOptions) {}

  async start(): Promise<void> {
    if (this.running) return
    this.running = true
    const generation = ++this.generation
    let analyser: AnalyserNode
    try {
      analyser = await microphone.acquire()
    } catch (e) {
      if (generation === this.generation) this.running = false
      throw e
    }
    if (generation !== this.generation) {
      // stop() (and maybe a new start()) ran while the permission prompt was open.
      microphone.release()
      return
    }
    this.acquired = true
    this.offEnded = microphone.onEnded(() => {
      this.stop()
      this.errorListeners.forEach((l) => l('no-device'))
    })

    const buf = new Float32Array(analyser.fftSize)
    const mpm = Mpm.forFloat32Array(analyser.fftSize)
    const sampleRate = analyser.context.sampleRate
    const tick = () => {
      analyser.getFloatTimeDomainData(buf)
      const { reading, rms } = analyzeFrame(buf, sampleRate, mpm, this.gate())
      const freq = this.smoother.push(reading?.freq ?? null)
      const out = reading && freq !== null ? { ...reading, freq } : null
      this.listeners.forEach((l) => l(out, rms))
      this.frame = requestAnimationFrame(tick)
    }
    this.frame = requestAnimationFrame(tick)
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    this.generation++
    this.offEnded?.()
    this.offEnded = null
    cancelAnimationFrame(this.frame)
    this.smoother.reset()
    if (this.acquired) {
      this.acquired = false
      microphone.release()
    }
  }

  onPitch(listener: PitchListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  onError(listener: (kind: MicErrorKind) => void): () => void {
    this.errorListeners.add(listener)
    return () => {
      this.errorListeners.delete(listener)
    }
  }
}
