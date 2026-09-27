import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  STORAGE_KEY,
  loadSettings,
  sanitizeSettings,
  saveSettings,
} from './settings'

const storageWith = (text: string | null) => ({ getItem: () => text })

describe('loadSettings', () => {
  it('returns defaults without storage or saved data', () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(loadSettings(storageWith(null))).toEqual(DEFAULT_SETTINGS)
  })
  it('returns defaults for corrupt JSON', () => {
    expect(loadSettings(storageWith('{not json'))).toEqual(DEFAULT_SETTINGS)
  })
  it('returns defaults when storage throws (blocked / private mode)', () => {
    const throwing = {
      getItem: () => {
        throw new Error('SecurityError')
      },
    }
    expect(loadSettings(throwing)).toEqual(DEFAULT_SETTINGS)
  })
  it('keeps valid saved fields and repairs invalid ones', () => {
    const saved = JSON.stringify({
      key: 'A',
      a4: 999,
      showAdvanced: true,
      labelMode: 'nope',
      bpm: 120,
    })
    expect(loadSettings(storageWith(saved))).toEqual({
      ...DEFAULT_SETTINGS,
      key: 'A',
      showAdvanced: true,
      bpm: 120,
    })
  })
})

describe('sanitizeSettings', () => {
  it('rejects unknown keys and out-of-range numbers', () => {
    expect(sanitizeSettings({ key: 'H', bpm: 10, noiseFloor: 5 })).toEqual(DEFAULT_SETTINGS)
    expect(sanitizeSettings('garbage')).toEqual(DEFAULT_SETTINGS)
  })
})

describe('matcher thresholds', () => {
  it('default to ±25 cents, 500 ms and 250 ms for melodies', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ toleranceCents: 25, holdMs: 500, melodyHoldMs: 250 })
  })
  it('keep valid saved values', () => {
    expect(sanitizeSettings({ toleranceCents: 10, holdMs: 800, melodyHoldMs: 150 })).toMatchObject({
      toleranceCents: 10,
      holdMs: 800,
      melodyHoldMs: 150,
    })
  })
  it('repair out-of-range or wrongly typed values', () => {
    expect(sanitizeSettings({ toleranceCents: 0, holdMs: 99999, melodyHoldMs: '250' })).toEqual(
      DEFAULT_SETTINGS,
    )
  })
})

describe('saveSettings', () => {
  it('writes JSON under the storage key', () => {
    const written: Record<string, string> = {}
    saveSettings({ setItem: (k, v) => void (written[k] = v) }, DEFAULT_SETTINGS)
    expect(JSON.parse(written[STORAGE_KEY])).toEqual(DEFAULT_SETTINGS)
  })
  it('swallows storage errors', () => {
    const full = {
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(() => saveSettings(full, DEFAULT_SETTINGS)).not.toThrow()
  })
})
