import { describe, expect, it } from 'vitest'
import { EXAMPLE_TAB, YOUR_TAB_KEY, loadYourTab, saveYourTab } from './yourTab'

describe('your tab storage', () => {
  it('saves and loads the text, including an empty one', () => {
    const data: Record<string, string> = {}
    const storage = {
      getItem: (k: string) => data[k] ?? null,
      setItem: (k: string, v: string) => void (data[k] = v),
    }
    expect(loadYourTab(storage)).toBe(EXAMPLE_TAB)
    saveYourTab(storage, '4 -4')
    expect(data[YOUR_TAB_KEY]).toBe('4 -4')
    expect(loadYourTab(storage)).toBe('4 -4')
    saveYourTab(storage, '')
    expect(loadYourTab(storage)).toBe('')
  })

  it('falls back to the example when storage is missing or throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('full')
      },
    }
    expect(loadYourTab(null)).toBe(EXAMPLE_TAB)
    expect(loadYourTab(throwing)).toBe(EXAMPLE_TAB)
    expect(() => saveYourTab(throwing, 'x')).not.toThrow()
  })
})
