import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { audioEngine } from '../../audio/AudioEngine'
import { loadLog } from '../log/practiceLog'
import { usePracticeTimer } from './usePracticeTimer'

let visibility: DocumentVisibilityState = 'visible'
let unlocked = false
let audioListeners = new Set<() => void>()

const setVisibility = (v: DocumentVisibilityState) => {
  visibility = v
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}
const setUnlocked = (u: boolean) => {
  unlocked = u
  act(() => audioListeners.forEach((l) => l()))
}
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))
const seconds = (pageId: string, date = '2026-09-27') =>
  loadLog(localStorage).days[date]?.[pageId] ?? 0

describe('usePracticeTimer', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 27, 10, 0, 0))
    visibility = 'visible'
    unlocked = false
    audioListeners = new Set()
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
    vi.spyOn(audioEngine, 'isUnlocked', 'get').mockImplementation(() => unlocked)
    vi.spyOn(audioEngine, 'onStateChange').mockImplementation((listener) => {
      audioListeners.add(listener)
      return () => {
        audioListeners.delete(listener)
      }
    })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('counts visible time on a page without audio, saving every 15 s', () => {
    renderHook(() => usePracticeTimer('quiz', { requireAudio: false }))
    advance(14_000)
    expect(seconds('quiz')).toBe(0)
    advance(1_000)
    expect(seconds('quiz')).toBe(15)
    advance(15_000)
    expect(seconds('quiz')).toBe(30)
  })

  it('does not count time while the page is hidden', () => {
    renderHook(() => usePracticeTimer('quiz', { requireAudio: false }))
    advance(5_000)
    setVisibility('hidden')
    expect(seconds('quiz')).toBe(5)
    advance(60_000)
    expect(seconds('quiz')).toBe(5)
    setVisibility('visible') // at 65 s; the next tick is at 75 s
    advance(10_000)
    expect(seconds('quiz')).toBe(15)
  })

  it('by default waits until audio is unlocked, and stops when it is suspended', () => {
    renderHook(() => usePracticeTimer('tuner'))
    advance(30_000)
    expect(seconds('tuner')).toBe(0)
    setUnlocked(true)
    advance(15_000)
    expect(seconds('tuner')).toBe(15)
    advance(5_000)
    setUnlocked(false)
    expect(seconds('tuner')).toBe(20)
    advance(30_000)
    expect(seconds('tuner')).toBe(20)
  })

  it('saves the last partial span on unmount', () => {
    const { unmount } = renderHook(() => usePracticeTimer('quiz', { requireAudio: false }))
    advance(5_000)
    unmount()
    expect(seconds('quiz')).toBe(5)
    advance(30_000)
    expect(seconds('quiz')).toBe(5)
  })

  it('saves on pagehide and resumes on pageshow', () => {
    renderHook(() => usePracticeTimer('quiz', { requireAudio: false }))
    advance(3_000)
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    expect(seconds('quiz')).toBe(3)
    act(() => {
      window.dispatchEvent(new Event('pageshow'))
    })
    advance(15_000)
    expect(seconds('quiz')).toBe(15)
  })

  it('gives time after midnight to the new day', () => {
    vi.setSystemTime(new Date(2026, 8, 27, 23, 59, 55))
    renderHook(() => usePracticeTimer('quiz', { requireAudio: false }))
    advance(15_000)
    expect(seconds('quiz', '2026-09-27')).toBe(5)
    expect(seconds('quiz', '2026-09-28')).toBe(10)
  })
})
