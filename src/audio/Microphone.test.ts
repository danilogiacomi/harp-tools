import { afterEach, describe, expect, it, vi } from 'vitest'
import { audioEngine } from './AudioEngine'
import { Microphone, MicrophoneError, mapMicError } from './Microphone'

describe('mapMicError', () => {
  it.each([
    ['NotAllowedError', 'denied'],
    ['SecurityError', 'denied'],
    ['NotFoundError', 'no-device'],
    ['OverconstrainedError', 'no-device'],
    ['NotReadableError', 'busy'],
    ['AbortError', 'busy'],
    ['SomethingElse', 'unknown'],
  ])('maps %s to %s', (name, kind) => {
    expect(mapMicError(new DOMException('x', name))).toBe(kind)
  })
  it('handles non-DOMException values', () => {
    expect(mapMicError(new Error('boom'))).toBe('unknown')
    expect(mapMicError(null)).toBe('unknown')
  })
})

/** Minimal stand-in for the AudioContext methods Microphone uses. */
function fakeCtx() {
  const analyser = {} as AnalyserNode
  const source = { connect: vi.fn(), disconnect: vi.fn() } as unknown as MediaStreamAudioSourceNode
  const createMediaStreamSource = vi.fn(() => source)
  const createAnalyser = vi.fn(() => analyser)
  return { createMediaStreamSource, createAnalyser } as unknown as AudioContext
}

function fakeStream(): { stream: MediaStream; track: { stop: ReturnType<typeof vi.fn> } } {
  const track = { stop: vi.fn() }
  const stream = { getTracks: () => [track] } as unknown as MediaStream
  return { stream, track }
}

function stubMediaDevices(getUserMedia: ReturnType<typeof vi.fn> | undefined): void {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: getUserMedia ? { getUserMedia } : undefined,
    configurable: true,
  })
}

describe('Microphone', () => {
  afterEach(() => {
    stubMediaDevices(undefined)
    vi.restoreAllMocks()
  })

  it('throws MicrophoneError("insecure") when getUserMedia is unavailable', async () => {
    stubMediaDevices(undefined)
    const mic = new Microphone()

    await expect(mic.acquire()).rejects.toMatchObject({ kind: 'insecure' })
  })

  it('shares one open() between concurrent acquire() calls', async () => {
    const { stream } = fakeStream()
    const getUserMedia = vi.fn().mockResolvedValue(stream)
    stubMediaDevices(getUserMedia)
    const ctx = fakeCtx()
    vi.spyOn(audioEngine, 'ctx', 'get').mockReturnValue(ctx)
    const mic = new Microphone()

    const [a, b] = await Promise.all([mic.acquire(), mic.acquire()])

    expect(a).toBe(b)
    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(ctx.createAnalyser).toHaveBeenCalledTimes(1)
  })

  it('stops the stream tracks only after the last release()', async () => {
    const { stream, track } = fakeStream()
    const getUserMedia = vi.fn().mockResolvedValue(stream)
    stubMediaDevices(getUserMedia)
    vi.spyOn(audioEngine, 'ctx', 'get').mockReturnValue(fakeCtx())
    const mic = new Microphone()

    await Promise.all([mic.acquire(), mic.acquire()])
    mic.release()
    expect(track.stop).not.toHaveBeenCalled()

    mic.release()
    expect(track.stop).toHaveBeenCalledTimes(1)
  })

  it('treats an extra release() as a no-op', async () => {
    const mic = new Microphone()
    expect(() => mic.release()).not.toThrow()

    const { stream } = fakeStream()
    const getUserMedia = vi.fn().mockResolvedValue(stream)
    stubMediaDevices(getUserMedia)
    vi.spyOn(audioEngine, 'ctx', 'get').mockReturnValue(fakeCtx())

    await expect(mic.acquire()).resolves.toBeDefined()
  })

  it('maps a getUserMedia rejection and leaves users at 0 so a later acquire() retries', async () => {
    const { stream } = fakeStream()
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('nope', 'NotAllowedError'))
      .mockResolvedValueOnce(stream)
    stubMediaDevices(getUserMedia)
    vi.spyOn(audioEngine, 'ctx', 'get').mockReturnValue(fakeCtx())
    const mic = new Microphone()

    await expect(mic.acquire()).rejects.toMatchObject({ kind: 'denied' })
    await expect(mic.acquire()).resolves.toBeDefined()
    expect(getUserMedia).toHaveBeenCalledTimes(2)
  })

  it('stops the late stream if everyone released while the prompt was pending', async () => {
    const { stream, track } = fakeStream()
    let resolveGetUserMedia!: (s: MediaStream) => void
    const getUserMedia = vi.fn(
      () =>
        new Promise<MediaStream>((resolve) => {
          resolveGetUserMedia = resolve
        }),
    )
    stubMediaDevices(getUserMedia)
    vi.spyOn(audioEngine, 'ctx', 'get').mockReturnValue(fakeCtx())
    const mic = new Microphone()

    const acquiring = mic.acquire()
    mic.release() // everyone released while the permission prompt is still open
    resolveGetUserMedia(stream)

    await expect(acquiring).rejects.toBeInstanceOf(MicrophoneError)
    await expect(acquiring).rejects.toMatchObject({ kind: 'unknown' })
    expect(track.stop).toHaveBeenCalledTimes(1)
  })
})
