import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_MIX } from '../../audio/backing/BackingScheduler'
import { bluesForm } from '../../core/jam/blues'
import { SettingsProvider } from '../settings/SettingsContext'
import { useBacking } from './useBacking'

const fake = vi.hoisted(() => ({
  onBar: null as ((bar: number) => void) | null,
  configs: [] as unknown[],
  mixes: [] as unknown[],
  a4s: [] as number[],
  stops: 0,
}))

vi.mock('../../audio/backing/BackingScheduler', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../audio/backing/BackingScheduler')>()
  return {
    ...real,
    BackingScheduler: class {
      isRunning = false
      constructor(_config: unknown, onBar: (bar: number) => void) {
        fake.onBar = onBar
      }
      setConfig(c: unknown) {
        fake.configs.push(c)
      }
      setMix(m: unknown) {
        fake.mixes.push(m)
      }
      setA4(a4: number) {
        fake.a4s.push(a4)
      }
      start() {
        this.isRunning = true
      }
      stop() {
        this.isRunning = false
        fake.stops++
      }
    },
  }
})

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider storage={null}>{children}</SettingsProvider>
)
const CONFIG = { bpm: 100, feel: 'shuffle' as const, form: bluesForm(false), tonicPc: 7 }

describe('useBacking', () => {
  it('starts and stops, reports the bar, and passes config, mix and A4 on', () => {
    const { result, unmount } = renderHook(() => useBacking(CONFIG, DEFAULT_MIX), { wrapper })
    expect(fake.configs.at(-1)).toBe(CONFIG)
    expect(fake.mixes.at(-1)).toBe(DEFAULT_MIX)
    expect(fake.a4s.at(-1)).toBe(440)
    act(() => result.current.toggle())
    expect(result.current.running).toBe(true)
    act(() => fake.onBar?.(3))
    expect(result.current.bar).toBe(3)
    act(() => result.current.toggle())
    expect(result.current).toMatchObject({ running: false, bar: null })
    const stops = fake.stops
    unmount()
    expect(fake.stops).toBe(stops + 1)
  })
})
