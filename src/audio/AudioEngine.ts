type Listener = () => void

/** Owns the app's single AudioContext. Browsers only allow starting it from a user gesture. */
export class AudioEngine {
  private context: AudioContext | null = null
  private output: GainNode | null = null
  private listeners = new Set<Listener>()

  get isUnlocked(): boolean {
    return this.context?.state === 'running'
  }

  get ctx(): AudioContext {
    if (!this.context) throw new Error('AudioEngine used before unlock()')
    return this.context
  }

  /** Everything audible connects here. */
  get master(): GainNode {
    if (!this.output) throw new Error('AudioEngine used before unlock()')
    return this.output
  }

  now(): number {
    return this.ctx.currentTime
  }

  /** Call from a user gesture (click/tap). Safe to call repeatedly. */
  async unlock(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: 'interactive' })
      this.output = this.context.createGain()
      this.output.connect(this.context.destination)
      this.context.addEventListener('statechange', () => this.listeners.forEach((l) => l()))
    }
    if (this.context.state !== 'running') await this.context.resume()
  }

  onStateChange(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}

export const audioEngine = new AudioEngine()

export function isWebAudioSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.AudioContext === 'function'
}
