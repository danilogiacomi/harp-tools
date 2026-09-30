import { describe, expect, it, vi } from 'vitest'
import {
  ScreenAwake,
  type VisibilitySource,
  type WakeLockApi,
  type WakeLockSentinelLike,
} from './screenAwake'

/** A fake Wake Lock API whose requests resolve (or reject) when the test says so. */
function fakeApi() {
  const sentinels: { release: ReturnType<typeof vi.fn>; drop: () => void }[] = []
  const pending: { resolve: () => void; reject: () => void }[] = []
  const api: WakeLockApi = {
    request: vi.fn(
      () =>
        new Promise<WakeLockSentinelLike>((resolve, reject) => {
          const listeners: (() => void)[] = []
          const sentinel = {
            release: vi.fn(async () => listeners.forEach((l) => l())),
            addEventListener: (_t: 'release', l: () => void) => listeners.push(l),
            /** The browser drops the lock by itself (tab hidden). */
            drop: () => listeners.forEach((l) => l()),
          }
          pending.push({
            resolve: () => {
              sentinels.push(sentinel)
              resolve(sentinel)
            },
            reject: () => reject(new DOMException('no', 'NotAllowedError')),
          })
        }),
    ),
  }
  return { api, sentinels, pending }
}

function fakeDoc() {
  let listener: (() => void) | undefined
  const doc = {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (_t: 'visibilitychange', l: () => void) => {
      listener = l
    },
  }
  const setVisibility = (state: DocumentVisibilityState) => {
    doc.visibilityState = state
    listener?.()
  }
  return { doc: doc as VisibilitySource, setVisibility }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('ScreenAwake', () => {
  it('requests the lock on the first hold and releases it after the last', async () => {
    const { api, sentinels, pending } = fakeApi()
    const awake = new ScreenAwake(api, fakeDoc().doc)

    const a = awake.hold()
    const b = awake.hold()
    expect(api.request).toHaveBeenCalledTimes(1)
    pending[0].resolve()
    await flush()

    a()
    expect(sentinels[0].release).not.toHaveBeenCalled()
    b()
    expect(sentinels[0].release).toHaveBeenCalledTimes(1)
  })

  it('treats a second call of the same release function as a no-op', async () => {
    const { api, sentinels, pending } = fakeApi()
    const awake = new ScreenAwake(api, fakeDoc().doc)
    const a = awake.hold()
    const b = awake.hold()
    pending[0].resolve()
    await flush()

    a()
    a()
    expect(sentinels[0].release).not.toHaveBeenCalled()
    b()
    expect(sentinels[0].release).toHaveBeenCalledTimes(1)
  })

  it('asks again when the page becomes visible while held', async () => {
    const { api, sentinels, pending } = fakeApi()
    const { doc, setVisibility } = fakeDoc()
    const awake = new ScreenAwake(api, doc)
    awake.hold()
    pending[0].resolve()
    await flush()

    sentinels[0].drop()
    setVisibility('hidden')
    expect(api.request).toHaveBeenCalledTimes(1)
    setVisibility('visible')
    expect(api.request).toHaveBeenCalledTimes(2)
  })

  it('does not ask on visibility when nothing is held', () => {
    const { api } = fakeApi()
    const { setVisibility } = (() => {
      const d = fakeDoc()
      new ScreenAwake(api, d.doc)
      return d
    })()
    setVisibility('visible')
    expect(api.request).not.toHaveBeenCalled()
  })

  it('is a no-op without the Wake Lock API', () => {
    const awake = new ScreenAwake(undefined, fakeDoc().doc)
    const release = awake.hold()
    expect(() => release()).not.toThrow()
  })

  it('a refused request is not retried in a loop', async () => {
    const { api, pending } = fakeApi()
    const awake = new ScreenAwake(api, fakeDoc().doc)
    awake.hold()
    pending[0].reject()
    await flush()
    await flush()
    expect(api.request).toHaveBeenCalledTimes(1)
    // A new hold is a new user action, so one more try is fine.
    awake.hold()
    expect(api.request).toHaveBeenCalledTimes(2)
  })

  it('releases a lock that arrives after everyone let go', async () => {
    const { api, sentinels, pending } = fakeApi()
    const awake = new ScreenAwake(api, fakeDoc().doc)
    const release = awake.hold()
    release()
    pending[0].resolve()
    await flush()
    expect(sentinels[0].release).toHaveBeenCalledTimes(1)
  })
})
