import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { SettingsProvider, useSettings } from '../settings/SettingsContext'
import { useHarp } from './useHarp'

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider storage={null}>{children}</SettingsProvider>
)

describe('useHarp', () => {
  it('builds the harp for the current key and tuning, and keeps it until they change', () => {
    const { result } = renderHook(() => ({ harp: useHarp(), api: useSettings() }), { wrapper })
    const first = result.current.harp
    const hole5Draw = () =>
      result.current.harp.find((n) => n.hole === 5 && n.technique === 'draw')!.midi
    expect(hole5Draw()).toBe(77)
    act(() => result.current.api.update({ bpm: 100 }))
    expect(result.current.harp).toBe(first)
    act(() => result.current.api.update({ tuning: 'country' }))
    expect(hole5Draw()).toBe(78)
    act(() => result.current.api.update({ key: 'G' }))
    expect(hole5Draw()).toBe(73)
  })
})
