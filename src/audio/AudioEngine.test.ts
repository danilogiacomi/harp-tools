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

    ctx.setState('suspended')
    expect(listener).toHaveBeenCalledOnce()
    expect(engine.isUnlocked).toBe(false)

    unsubscribe()
    ctx.setState('running')
    expect(listener).toHaveBeenCalledOnce()
  })
})
