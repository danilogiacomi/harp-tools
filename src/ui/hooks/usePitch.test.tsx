import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { MicErrorKind } from '../../audio/Microphone'
import type { PitchListener } from '../../audio/pitch/PitchDetector'
import { SettingsProvider } from '../settings/SettingsContext'
import { usePitch } from './usePitch'

const detector = vi.hoisted(() => ({
  errorListener: null as ((kind: MicErrorKind) => void) | null,
  pitchListener: null as PitchListener | null,
}))

vi.mock('../../audio/pitch/PitchyDetector', () => ({
  PitchyDetector: class {
    start = vi.fn(async () => {})
    stop = vi.fn()
    onPitch = (l: PitchListener) => {
      detector.pitchListener = l
      return () => {
        detector.pitchListener = null
      }
    }
    onError = (l: (kind: MicErrorKind) => void) => {
      detector.errorListener = l
      return () => {
        detector.errorListener = null
      }
    }
  },
}))

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider storage={null}>{children}</SettingsProvider>
)

describe('usePitch', () => {
  it('reports the no-device error when the detector loses the mic mid-session', () => {
    const { result, unmount } = renderHook(() => usePitch(true), { wrapper })
    expect(result.current.status).toBe('starting')

    act(() => detector.errorListener?.('no-device'))
    expect(result.current).toMatchObject({ status: 'error', error: 'no-device' })

    unmount()
    expect(detector.errorListener).toBeNull()
  })

  it('hands every reading to the latest onReading callback', () => {
    const first = vi.fn()
    const second = vi.fn()
    const reading = { freq: 440, clarity: 0.95, rms: 0.1 }
    const { rerender } = renderHook(({ cb }) => usePitch(true, cb), {
      wrapper,
      initialProps: { cb: first },
    })
    act(() => detector.pitchListener?.(reading, 0.1))
    expect(first).toHaveBeenCalledWith(reading, 0.1)

    rerender({ cb: second })
    act(() => detector.pitchListener?.(null, 0.002))
    expect(second).toHaveBeenCalledWith(null, 0.002)
    expect(first).toHaveBeenCalledTimes(1)
  })
})
