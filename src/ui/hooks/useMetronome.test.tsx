import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TIME_SIGNATURES } from '../../core/rhythm/schedule'
import { useMetronome } from './useMetronome'

const captured = vi.hoisted(() => ({ onBeat: null as ((pulse: number) => void) | null }))

vi.mock('../../audio/Metronome', () => ({
  Metronome: class {
    isRunning = false
    constructor(_config: unknown, onBeat: (pulse: number) => void) {
      captured.onBeat = onBeat
    }
    setConfig() {}
    start() {
      this.isRunning = true
    }
    stop() {
      this.isRunning = false
    }
  },
}))

const CONFIG = { bpm: 120, signature: TIME_SIGNATURES[2], subdivision: 1 as const }

afterEach(() => vi.restoreAllMocks())

describe('useMetronome', () => {
  it('records when the latest beat was heard, and forgets it when stopped', () => {
    const { result } = renderHook(() => useMetronome(CONFIG))
    act(() => result.current.toggle())
    expect(result.current.running).toBe(true)
    vi.spyOn(performance, 'now').mockReturnValue(1234)
    act(() => captured.onBeat?.(2))
    expect(result.current).toMatchObject({ beat: 2, lastBeatMs: 1234 })
    act(() => result.current.toggle())
    expect(result.current).toMatchObject({ running: false, beat: null, lastBeatMs: null })
  })
})
