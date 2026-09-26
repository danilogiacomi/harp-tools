import { PitchDetector as Mpm } from 'pitchy'
import { microphone } from '../Microphone'
import { MedianSmoother, analyzeFrame, type GateOptions } from './analysis'
import type { PitchDetector, PitchListener } from './PitchDetector'

/** Reads the shared mic on every animation frame and runs pitchy (McLeod) on it. */
export class PitchyDetector implements PitchDetector {
  private listeners = new Set<PitchListener>()
  private smoother = new MedianSmoother(3)
  private frame = 0
  private running = false
  private acquired = false

  constructor(private readonly gate: () => GateOptions) {}

  async start(): Promise<void> {
    if (this.running) return
    this.running = true
    let analyser: AnalyserNode
    try {
      analyser = await microphone.acquire()
    } catch (e) {
      this.running = false
      throw e
    }
    if (!this.running) {
      // stop() was called while the permission prompt was open.
      microphone.release()
      return
    }
    this.acquired = true

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
}
