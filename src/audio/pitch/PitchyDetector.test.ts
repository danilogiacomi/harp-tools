import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MicrophoneError, microphone } from '../Microphone'
import type { PitchListener } from './PitchDetector'
import { PitchyDetector } from './PitchyDetector'

vi.mock('../Microphone', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../Microphone')>()
  return {
    ...actual,
    microphone: { acquire: vi.fn(), release: vi.fn() },
  }
})

const SR = 8000
const N = 2048
const GATE = { minClarity: 0, noiseFloor: 0 }

/** A pure tone the fake analyser "reads" on getFloatTimeDomainData(). */
function fakeAnalyser(freq = 200, sampleRate = SR): AnalyserNode {
  return {
    fftSize: N,
    context: { sampleRate },
    getFloatTimeDomainData: vi.fn((buf: Float32Array) => {
      for (let i = 0; i < buf.length; i++) {
        const phase = (freq * i) / sampleRate - Math.floor((freq * i) / sampleRate)
        buf[i] = 0.5 * Math.sin(2 * Math.PI * phase)
      }
    }),
  } as unknown as AnalyserNode
}

let rafCallbacks: FrameRequestCallback[]
let requestAnimationFrame: ReturnType<typeof vi.fn>
let cancelAnimationFrame: ReturnType<typeof vi.fn>

beforeEach(() => {
  rafCallbacks = []
  requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
    rafCallbacks.push(cb)
    return rafCallbacks.length
  })
  cancelAnimationFrame = vi.fn()
  vi.stubGlobal('requestAnimationFrame', requestAnimationFrame)
  vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('PitchyDetector', () => {
  it('starts, runs one animation frame, and notifies listeners with a reading', async () => {
    vi.mocked(microphone.acquire).mockResolvedValue(fakeAnalyser(200))
    const detector = new PitchyDetector(() => GATE)
    const listener = vi.fn<PitchListener>()
    detector.onPitch(listener)

    await detector.start()
    expect(microphone.acquire).toHaveBeenCalledTimes(1)
    expect(rafCallbacks).toHaveLength(1)

    rafCallbacks[0](0)

    expect(listener).toHaveBeenCalledTimes(1)
    const [reading, rms] = listener.mock.calls[0]
    expect(rms).toBeGreaterThan(0)
    expect(reading).not.toBeNull()
    expect(Math.abs(reading!.freq - 200)).toBeLessThan(5)

    detector.stop()
  })

  it('stop() cancels the pending frame and releases the mic exactly once', async () => {
    vi.mocked(microphone.acquire).mockResolvedValue(fakeAnalyser())
    const detector = new PitchyDetector(() => ({ minClarity: 0.9, noiseFloor: 0.01 }))

    await detector.start()
    detector.stop()

    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1)
    expect(microphone.release).toHaveBeenCalledTimes(1)

    detector.stop() // idempotent
    expect(microphone.release).toHaveBeenCalledTimes(1)
  })

  it('releases exactly once and never starts a loop if stop() runs while acquire() is pending', async () => {
    let resolveAcquire!: (a: AnalyserNode) => void
    vi.mocked(microphone.acquire).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAcquire = resolve
        }),
    )
    const detector = new PitchyDetector(() => ({ minClarity: 0.9, noiseFloor: 0.01 }))

    const starting = detector.start()
    detector.stop() // the permission prompt is still open
    resolveAcquire(fakeAnalyser())
    await starting

    expect(microphone.release).toHaveBeenCalledTimes(1)
    expect(requestAnimationFrame).not.toHaveBeenCalled()
  })

  it('propagates a start() rejection, and a later start() succeeds', async () => {
    const error = new MicrophoneError('denied')
    vi.mocked(microphone.acquire).mockRejectedValueOnce(error)
    const detector = new PitchyDetector(() => ({ minClarity: 0.9, noiseFloor: 0.01 }))

    await expect(detector.start()).rejects.toBe(error)

    vi.mocked(microphone.acquire).mockResolvedValueOnce(fakeAnalyser())
    await expect(detector.start()).resolves.toBeUndefined()
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)

    detector.stop()
  })
})
