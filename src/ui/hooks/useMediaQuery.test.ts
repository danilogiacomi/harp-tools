import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useMediaQuery } from './useMediaQuery'

/** A controllable matchMedia: `set(true)` flips every query and fires 'change'. */
function stubMatchMedia(initial: boolean) {
  let matches = initial
  const listeners = new Set<() => void>()
  window.matchMedia = ((query: string) => ({
    get matches() {
      return matches
    },
    media: query,
    addEventListener: (_: 'change', l: () => void) => listeners.add(l),
    removeEventListener: (_: 'change', l: () => void) => listeners.delete(l),
  })) as unknown as typeof window.matchMedia
  return (next: boolean) => {
    matches = next
    listeners.forEach((l) => l())
  }
}

afterEach(() => {
  // jsdom has no matchMedia; put it back the way it was.
  delete (window as { matchMedia?: unknown }).matchMedia
})

describe('useMediaQuery', () => {
  it('returns false when matchMedia is missing', () => {
    delete (window as { matchMedia?: unknown }).matchMedia
    const { result } = renderHook(() => useMediaQuery('(max-width: 34rem)'))
    expect(result.current).toBe(false)
  })

  it('follows the query as it changes', () => {
    const set = stubMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(max-width: 34rem)'))
    expect(result.current).toBe(false)
    act(() => set(true))
    expect(result.current).toBe(true)
  })
})
