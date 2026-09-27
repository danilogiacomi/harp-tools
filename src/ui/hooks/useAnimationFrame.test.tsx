import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAnimationFrame } from './useAnimationFrame'

describe('useAnimationFrame', () => {
  let callbacks: FrameRequestCallback[] = []
  beforeEach(() => {
    callbacks = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => callbacks.push(cb))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })
  afterEach(() => vi.unstubAllGlobals())

  /** Runs the pending frame at `t`. */
  const frame = (t: number) => {
    const pending = callbacks
    callbacks = []
    pending.forEach((cb) => cb(t))
  }

  it('draws at most once per interval', () => {
    const draw = vi.fn()
    renderHook(() => useAnimationFrame(draw, 30))
    ;[0, 16, 33, 50, 66].forEach(frame)
    expect(draw.mock.calls.map((c) => c[0])).toEqual([0, 33, 66])
  })

  it('always calls the latest draw function and stops on unmount', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender, unmount } = renderHook(({ draw }) => useAnimationFrame(draw), {
      initialProps: { draw: first },
    })
    frame(0)
    rerender({ draw: second })
    frame(16)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledWith(16)
    unmount()
    expect(cancelAnimationFrame).toHaveBeenCalled()
  })
})
