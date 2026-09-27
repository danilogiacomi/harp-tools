import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTimeouts } from './useTimeouts'

afterEach(() => vi.useRealTimers())

describe('useTimeouts', () => {
  it('runs callbacks after the delay', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const { result } = renderHook(() => useTimeouts())
    result.current.after(1000, fn)
    vi.advanceTimersByTime(999)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledOnce()
  })

  it('drops pending callbacks on clear() and on unmount', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const { result, unmount } = renderHook(() => useTimeouts())
    result.current.after(100, fn)
    result.current.clear()
    result.current.after(100, fn)
    unmount()
    vi.advanceTimersByTime(1000)
    expect(fn).not.toHaveBeenCalled()
  })
})
