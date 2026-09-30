import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BackingConfig } from '../../../core/jam/backingSchedule'
import { bluesForm } from '../../../core/jam/blues'
import { fakeBand } from '../../../test/fakeBackingScheduler'
import { SettingsProvider } from '../../settings/SettingsContext'
import { useSongBand } from './useSongBand'

vi.mock(
  '../../../audio/backing/BackingScheduler',
  () => import('../../../test/fakeBackingScheduler'),
)

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider storage={null}>{children}</SettingsProvider>
)
const CONFIG: BackingConfig = {
  bpm: 80,
  feel: 'shuffle',
  form: bluesForm(false),
  tonicPc: 7,
  countInBars: 1,
  loop: false,
}

describe('useSongBand', () => {
  beforeEach(() => fakeBand.reset())

  it('passes the config and A4 on, and tells the latest listener each bar', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(({ onBar }) => useSongBand(CONFIG, onBar), {
      wrapper,
      initialProps: { onBar: first },
    })
    expect(fakeBand.config).toBe(CONFIG)
    expect(fakeBand.a4).toBe(440)
    rerender({ onBar: second })
    act(() => fakeBand.onBar?.(3))
    expect(second).toHaveBeenCalledWith(3)
    expect(first).not.toHaveBeenCalled()
  })

  it('restarts from the top when started while playing', () => {
    const { result } = renderHook(() => useSongBand(CONFIG, vi.fn()), { wrapper })
    act(() => result.current.start())
    expect(fakeBand).toMatchObject({ starts: 1, stops: 0, running: true })
    act(() => result.current.start())
    expect(fakeBand).toMatchObject({ starts: 2, stops: 1, running: true })
    act(() => result.current.stop())
    expect(fakeBand.running).toBe(false)
  })

  it('disposes of the band on unmount', () => {
    const { result, unmount } = renderHook(() => useSongBand(CONFIG, vi.fn()), { wrapper })
    act(() => result.current.start())
    unmount()
    expect(fakeBand).toMatchObject({ disposes: 1, running: false })
  })
})
