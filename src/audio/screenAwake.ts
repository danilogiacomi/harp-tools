/** Something that can keep the screen on while at least one caller holds it. */
export interface KeepAwake {
  /** Keep the screen on until the returned function is called (calling it twice is harmless). */
  hold(): () => void
}

export interface WakeLockSentinelLike {
  release(): Promise<void>
  addEventListener(type: 'release', listener: () => void): void
}

export interface WakeLockApi {
  request(type: 'screen'): Promise<WakeLockSentinelLike>
}

export interface VisibilitySource {
  readonly visibilityState: DocumentVisibilityState
  addEventListener(type: 'visibilitychange', listener: () => void): void
}

function browserWakeLock(): WakeLockApi | undefined {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return undefined
  return navigator.wakeLock as unknown as WakeLockApi
}

/**
 * Keeps the screen on while the mic listens or the app plays, so a phone on a music stand
 * doesn't sleep mid-exercise. Browsers drop the lock whenever the page is hidden, so it is
 * requested again on return. Unsupported or refused requests are silently ignored.
 */
export class ScreenAwake implements KeepAwake {
  private holds = 0
  private sentinel: WakeLockSentinelLike | null = null
  private requesting = false

  constructor(
    private readonly api: WakeLockApi | undefined = browserWakeLock(),
    doc: VisibilitySource | undefined = typeof document === 'undefined' ? undefined : (document as VisibilitySource),
  ) {
    doc?.addEventListener('visibilitychange', () => {
      if (doc.visibilityState === 'visible') this.sync()
    })
  }

  hold(): () => void {
    this.holds++
    this.sync()
    let released = false
    return () => {
      if (released) return
      released = true
      this.holds--
      this.sync()
    }
  }

  private sync(): void {
    if (!this.api) return
    if (this.holds > 0 && !this.sentinel && !this.requesting) {
      void this.request(this.api)
    } else if (this.holds === 0 && this.sentinel) {
      const sentinel = this.sentinel
      this.sentinel = null
      sentinel.release().catch(() => {})
    }
  }

  private async request(api: WakeLockApi): Promise<void> {
    this.requesting = true
    try {
      const sentinel = await api.request('screen')
      sentinel.addEventListener('release', () => {
        if (this.sentinel === sentinel) this.sentinel = null
      })
      this.sentinel = sentinel
    } catch {
      // Refused (battery saver, hidden page, permissions policy). No retry here: the next
      // hold() or return to the page tries again, so a refusal can't loop.
      return
    } finally {
      this.requesting = false
    }
    this.sync() // everyone may have let go while the request was pending
  }
}

export const screenAwake = new ScreenAwake()
