import { describe, expect, it } from 'vitest'
import { HEALTH_KEY, healthId, loadHealth, saveHealth, type SavedHealth } from './healthStore'

const memory = (initial: Record<string, string> = {}) => {
  const data = { ...initial }
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v
    },
  }
}
const check: SavedHealth = { date: '2026-09-27', a4: 440, cents: Array(20).fill(3) }

describe('health store', () => {
  it('saves and loads the latest check per key and tuning', () => {
    const s = memory()
    saveHealth(s, healthId('C', 'richter'), check)
    saveHealth(s, healthId('G', 'country'), { ...check, a4: 442 })
    expect(loadHealth(s, 'C|richter')).toEqual(check)
    expect(loadHealth(s, 'G|country')?.a4).toBe(442)
    expect(loadHealth(s, 'A|richter')).toBeNull()
  })

  it('ignores corrupt, hand-edited or missing storage', () => {
    expect(loadHealth(memory({ [HEALTH_KEY]: 'not json' }), 'C|richter')).toBeNull()
    expect(loadHealth(memory({ [HEALTH_KEY]: '[1,2]' }), 'C|richter')).toBeNull()
    const bad = JSON.stringify({ 'C|richter': { ...check, cents: [1, 2] } })
    expect(loadHealth(memory({ [HEALTH_KEY]: bad }), 'C|richter')).toBeNull()
    expect(loadHealth(null, 'C|richter')).toBeNull()
  })

  it('survives storage that throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('full')
      },
    }
    expect(loadHealth(throwing, 'C|richter')).toBeNull()
    expect(() => saveHealth(throwing, 'C|richter', check)).not.toThrow()
    expect(() => saveHealth(null, 'C|richter', check)).not.toThrow()
  })
})
