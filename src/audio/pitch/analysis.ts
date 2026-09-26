export interface GateOptions {
  /** pitchy clarity (0–1) required to trust a reading. */
  minClarity: number
  /** Linear RMS below which the frame counts as silence. */
  noiseFloor: number
}

/** The part of pitchy's PitchDetector we use — lets tests or other detectors stand in. */
export interface FrameAnalyzer {
  findPitch(input: Float32Array, sampleRate: number): [number, number]
}

export function computeRms(buf: Float32Array): number {
  let sum = 0
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
  return Math.sqrt(sum / buf.length)
}

export function analyzeFrame(
  buf: Float32Array,
  sampleRate: number,
  analyzer: FrameAnalyzer,
  gate: GateOptions,
): { reading: { freq: number; clarity: number; rms: number } | null; rms: number } {
  const rms = computeRms(buf)
  if (rms < gate.noiseFloor) return { reading: null, rms }
  const [freq, clarity] = analyzer.findPitch(buf, sampleRate)
  if (clarity < gate.minClarity || !Number.isFinite(freq) || freq <= 0)
    return { reading: null, rms }
  return { reading: { freq, clarity, rms }, rms }
}

/** Median over the last `size` readings; a null (silence) clears the history. */
export class MedianSmoother {
  private values: number[] = []

  constructor(private readonly size = 3) {}

  push(value: number | null): number | null {
    if (value === null) {
      this.reset()
      return null
    }
    this.values.push(value)
    if (this.values.length > this.size) this.values.shift()
    const sorted = [...this.values].sort((a, b) => a - b)
    // Lower median for even counts, so a single upward octave spike can't win.
    return sorted[Math.floor((sorted.length - 1) / 2)]
  }

  reset(): void {
    this.values = []
  }
}
