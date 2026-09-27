import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioEngine } from './AudioEngine'

class FakeGainNode {
  connect = vi.fn()
}

/** Minimal stand-in for the real AudioContext; jsdom doesn't provide one. */
class FakeAudioContext {
  static instances: FakeAudioContext[] = []

  state: AudioContextState = 'suspended'
  currentTime = 0
  destination = {} as AudioDestinationNode
  resume = vi.fn(async () => {
    this.state = 'running'
    this.fireStateChange()
  })
  private listeners = new Set<() => void>()

  constructor(readonly options?: AudioContextOptions) {
    FakeAudioContext.instances.push(this)
  }

  createGain(): GainNode {
    return new FakeGainNode() as unknown as GainNode
  }

  addEventListener(type: string, listener: () => void): void {
    if (type === 'statechange') this.listeners.add(listener)
  }

  removeEventListener(type: string, listener: () => void): void {
    if (type === 'statechange') this.listeners.delete(listener)
  }

  /** Test helper: simulate the browser changing state on its own (e.g. an iOS interruption). */
  setState(state: AudioContextState): void {
    this.state = state
    this.fireStateChange()
  }

  private fireStateChange(): void {
    this.listeners.forEach((l) => l())
  }
}

describe('AudioEngine', () => {
  beforeEach(() => {
    FakeAudioContext.instances = []
    vi.stubGlobal('AudioContext', FakeAudioContext)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('throws when used before unlock()', () => {
    const engine = new AudioEngine()
    expect(() => engine.ctx).toThrow(/unlock/)
    expect(() => engine.master).toThrow(/unlock/)
    expect(() => engine.now()).toThrow(/unlock/)
    expect(engine.isUnlocked).toBe(false)
  })

  it('creates one context and resumes it on unlock', async () => {
    const engine = new AudioEngine()
    await engine.unlock()

    expect(FakeAudioContext.instances).toHaveLength(1)
    const ctx = FakeAudioContext.instances[0]
    expect(ctx.resume).toHaveBeenCalledOnce()
    expect(ctx.state).toBe('running')
    expect(engine.isUnlocked).toBe(true)
    expect(engine.ctx).toBe(ctx as unknown as AudioContext)
  })

  it('reuses the same context and does not resume again once running', async () => {
    const engine = new AudioEngine()
    await engine.unlock()
    await engine.unlock()

    expect(FakeAudioContext.instances).toHaveLength(1)
    expect(FakeAudioContext.instances[0].resume).toHaveBeenCalledOnce()
  })

  it('notifies onStateChange listeners and stops after unsubscribing', async () => {
    const engine = new AudioEngine()
    await engine.unlock()
    const ctx = FakeAudioContext.instances[0]
    const listener = vi.fn()
    const unsubscribe = engine.onStateChange(listener)

    ctx.setState('closed')
    expect(listener).toHaveBeenCalledOnce()
    expect(engine.isUnlocked).toBe(false)

    unsubscribe()
    ctx.setState('running')
    expect(listener).toHaveBeenCalledOnce()
  })

  it('resumes on its own when the browser suspends or interrupts the context', async () => {
    const engine = new AudioEngine()
    await engine.unlock()
    const ctx = FakeAudioContext.instances[0]

    ctx.setState('suspended')
    expect(ctx.resume).toHaveBeenCalledTimes(2)
    expect(engine.isUnlocked).toBe(true)

    ctx.setState('interrupted' as AudioContextState)
    expect(ctx.resume).toHaveBeenCalledTimes(3)
    expect(engine.isUnlocked).toBe(true)
    expect(engine.needsGesture).toBe(false)
  })

  it('reports needsGesture and notifies when an automatic resume is refused', async () => {
    const engine = new AudioEngine()
    await engine.unlock()
    const ctx = FakeAudioContext.instances[0]
    const listener = vi.fn()
    engine.onStateChange(listener)
    ctx.resume.mockRejectedValueOnce(new DOMException('no gesture', 'NotAllowedError'))

    ctx.setState('suspended')
    expect(engine.needsGesture).toBe(false) // still trying
    await vi.waitFor(() => expect(engine.needsGesture).toBe(true))
    expect(listener).toHaveBeenCalledTimes(2)

    await engine.unlock() // the user taps the overlay
    expect(engine.isUnlocked).toBe(true)
    expect(engine.needsGesture).toBe(false)
  })

  it('treats a resume that resolves without running as needing a gesture', async () => {
    const engine = new AudioEngine()
    await engine.unlock()
    const ctx = FakeAudioContext.instances[0]
    ctx.resume.mockResolvedValueOnce(undefined)

    ctx.setState('suspended')
    await vi.waitFor(() => expect(engine.needsGesture).toBe(true))
  })

  it('tries to resume when the page becomes visible again', async () => {
    const engine = new AudioEngine()
    await engine.unlock()
    const ctx = FakeAudioContext.instances[0]
    ctx.resume.mockRejectedValueOnce(new Error('no gesture'))
    ctx.setState('suspended')
    await vi.waitFor(() => expect(engine.needsGesture).toBe(true))
    const calls = ctx.resume.mock.calls.length

    document.dispatchEvent(new Event('visibilitychange'))
    expect(ctx.resume).toHaveBeenCalledTimes(calls + 1)
    expect(engine.isUnlocked).toBe(true)
  })

  it('does not resume while the page is hidden', async () => {
    const engine = new AudioEngine()
    await engine.unlock()
    const ctx = FakeAudioContext.instances[0]
    ctx.state = 'suspended' // without a statechange event
    const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')

    document.dispatchEvent(new Event('visibilitychange'))
    expect(ctx.resume).toHaveBeenCalledOnce()
    hidden.mockRestore()
  })

  it('needs a gesture before the first unlock', () => {
    expect(new AudioEngine().needsGesture).toBe(true)
  })

  describe('iOS audio session', () => {
    afterEach(() => {
      delete (navigator as { audioSession?: unknown }).audioSession
    })

    it('asks for the playback session so the silent switch does not mute the tools', async () => {
      const audioSession = { type: 'auto' }
      Object.defineProperty(navigator, 'audioSession', { value: audioSession, configurable: true })
      await new AudioEngine().unlock()
      expect(audioSession.type).toBe('playback')
    })

    it('still unlocks when setting the session type throws', async () => {
      const audioSession = {
        set type(_: string) {
          throw new Error('nope')
        },
      }
      Object.defineProperty(navigator, 'audioSession', { value: audioSession, configurable: true })
      const engine = new AudioEngine()
      await engine.unlock()
      expect(engine.isUnlocked).toBe(true)
    })

    it('unlocks normally where navigator.audioSession does not exist', async () => {
      expect('audioSession' in navigator).toBe(false)
      const engine = new AudioEngine()
      await engine.unlock()
      expect(engine.isUnlocked).toBe(true)
    })
  })

  it('tells listeners when unlock() succeeds, even if the context starts out running', async () => {
    class RunningContext extends FakeAudioContext {
      state: AudioContextState = 'running'
    }
    vi.stubGlobal('AudioContext', RunningContext)
    const engine = new AudioEngine()
    const listener = vi.fn()
    engine.onStateChange(listener)
    await engine.unlock()
    expect(engine.isUnlocked).toBe(true)
    expect(listener).toHaveBeenCalled()
  })
})
