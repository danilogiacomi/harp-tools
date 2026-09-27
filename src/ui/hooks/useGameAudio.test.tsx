import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PitchListener } from '../../audio/pitch/PitchDetector'
import { SettingsProvider } from '../settings/SettingsContext'
import { useGameAudio } from './useGameAudio'

const mocks = vi.hoisted(() => ({
  onReading: null as PitchListener | null,
  sounding: null as ((sounding: boolean) => void) | null,
  now: 0,
}))

const player = vi.hoisted(() => ({
  play: vi.fn(async () => {}),
  start: vi.fn(),
  stop: vi.fn(),
  isSounding: false,
  onSoundingChange: (l: (sounding: boolean) => void) => {
    mocks.sounding = l
    return () => {
      mocks.sounding = null
    }
  },
}))

vi.mock('./usePitch', () => ({
  usePitch: (_enabled: boolean, onReading: PitchListener) => {
    mocks.onReading = onReading
    return { reading: null, rms: 0, status: 'listening', error: null }
  },
}))
vi.mock('./useNotePlayer', () => ({ useNotePlayer: () => player }))

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider storage={null}>{children}</SettingsProvider>
)
const A4 = { freq: 440, clarity: 0.95, rms: 0.1 }
const hear = (at: number) => {
  mocks.now = at
  act(() => mocks.onReading?.(A4, 0.1))
}

describe('useGameAudio', () => {
  beforeEach(() => {
    vi.spyOn(performance, 'now').mockImplementation(() => mocks.now)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('passes mic readings through while the site is silent', () => {
    const heard = vi.fn()
    const { result } = renderHook(() => useGameAudio(true), { wrapper })
    result.current.listen(heard)
    hear(1000)
    expect(heard).toHaveBeenLastCalledWith(440, 1000)
    expect(result.current.detectedMidi).toBe(69)
    expect(result.current.now()).toBe(1000)
  })

  it('ignores the mic while a prompt sounds and for 150 ms after (spec §6.6)', () => {
    const heard = vi.fn()
    const { result } = renderHook(() => useGameAudio(true), { wrapper })
    result.current.listen(heard)
    mocks.now = 1000
    act(() => mocks.sounding?.(true))
    hear(1100)
    expect(heard).toHaveBeenLastCalledWith(null, 1100)
    expect(result.current.detectedMidi).toBeNull()

    mocks.now = 2000
    act(() => mocks.sounding?.(false))
    hear(2149)
    expect(heard).toHaveBeenLastCalledWith(null, 2149)
    hear(2150)
    expect(heard).toHaveBeenLastCalledWith(440, 2150)
    expect(result.current.detectedMidi).toBe(69)
  })

  it('reports silence as null', () => {
    const heard = vi.fn()
    const { result } = renderHook(() => useGameAudio(true), { wrapper })
    result.current.listen(heard)
    mocks.now = 500
    act(() => mocks.onReading?.(null, 0.001))
    expect(heard).toHaveBeenLastCalledWith(null, 500)
  })

  it('calls the most recently registered listener, and returns stable functions', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { result, rerender } = renderHook(() => useGameAudio(true), { wrapper })
    const { listen, playSequence } = result.current
    listen(first)
    rerender()
    expect(result.current.listen).toBe(listen)
    expect(result.current.playSequence).toBe(playSequence)
    result.current.listen(second)
    hear(10)
    expect(second).toHaveBeenCalledWith(440, 10)
    expect(first).not.toHaveBeenCalled()
  })

  it('stops calling a listener once it unregisters', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { result } = renderHook(() => useGameAudio(true), { wrapper })
    const offFirst = result.current.listen(first)
    const offSecond = result.current.listen(second)
    offFirst()
    hear(10)
    expect(second).toHaveBeenCalledWith(440, 10)
    offSecond()
    hear(20)
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
  })
})
