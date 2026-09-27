type Listener = () => void

/** Safari's Audio Session API; not in TypeScript's DOM lib yet. */
type NavigatorWithAudioSession = Navigator & { audioSession?: { type: string } }

/** Owns the app's single AudioContext. Browsers only allow starting it from a user gesture. */
export class AudioEngine {
  private context: AudioContext | null = null
  private output: GainNode | null = null
  private listeners = new Set<Listener>()
  private resumeFailed = false

  get isUnlocked(): boolean {
    return this.context?.state === 'running'
  }

  /** True when audio is stopped and only a user gesture (unlock()) can restart it. */
  get needsGesture(): boolean {
    if (!this.context) return true
    return !this.isUnlocked && this.resumeFailed
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
    requestPlaybackSession()
    if (!this.context) {
      const ctx = new AudioContext({ latencyHint: 'interactive' })
      this.context = ctx
      this.output = ctx.createGain()
      this.output.connect(ctx.destination)
      ctx.addEventListener('statechange', () => {
        const state: string = ctx.state
        if (state === 'suspended' || state === 'interrupted') this.autoResume()
        this.notify()
      })
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') this.autoResume()
        })
      }
    }
    if (this.context.state !== 'running') await this.context.resume()
    this.resumeFailed = false
    // A context created already running fires no statechange; tell listeners either way.
    this.notify()
  }

  onStateChange(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Without a gesture this may be refused, or (Safari) stay pending until the user interacts. */
  private autoResume(): void {
    const ctx = this.context
    if (!ctx || ctx.state === 'running' || ctx.state === 'closed') return
    this.resumeFailed = false
    const failed = () => {
      if (ctx.state === 'running') return
      this.resumeFailed = true
      this.notify()
    }
    ctx.resume().then(failed, failed)
  }

  private notify(): void {
    this.listeners.forEach((l) => l())
  }
}

/** iOS mutes Web Audio's default "ambient" session with the silent switch; tools should sound. */
function requestPlaybackSession(): void {
  if (typeof navigator === 'undefined' || !('audioSession' in navigator)) return
  try {
    const session = (navigator as NavigatorWithAudioSession).audioSession
    if (session) session.type = 'playback'
  } catch {
    // Not fatal: at worst the silent switch mutes us.
  }
}

export const audioEngine = new AudioEngine()

export function isWebAudioSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.AudioContext === 'function'
}
