import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { MicErrorKind } from '../../audio/Microphone'
import { SettingsProvider } from '../settings/SettingsContext'
import { usePitch } from './usePitch'

const detector = vi.hoisted(() => ({
  errorListener: null as ((kind: MicErrorKind) => void) | null,
}))

vi.mock('../../audio/pitch/PitchyDetector', () => ({
  PitchyDetector: class {
    start = vi.fn(async () => {})
    stop = vi.fn()
    onPitch = () => () => {}
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
})
