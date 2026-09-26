import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SettingsProvider, useSettings } from './SettingsContext'
import { STORAGE_KEY } from './settings'

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size
    },
  }
}

function Probe() {
  const { settings, update } = useSettings()
  return <button onClick={() => update({ key: 'A' })}>{settings.key}</button>
}

describe('SettingsProvider', () => {
  it('provides settings and persists updates', () => {
    const storage = memoryStorage()
    render(
      <SettingsProvider storage={storage}>
        <Probe />
      </SettingsProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'C' }))
    expect(screen.getByRole('button', { name: 'A' })).toBeInTheDocument()
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).key).toBe('A')
  })

  it('throws a helpful error outside the provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow(/SettingsProvider/)
    consoleError.mockRestore()
  })
})
