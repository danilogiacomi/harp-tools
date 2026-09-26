import { describe, expect, it } from 'vitest'
import { formatCents, levelPercent, tuneQuality } from './tunerMath'

describe('tuneQuality', () => {
  it('is in tune within ±10 cents, close within ±25, off beyond', () => {
    expect(tuneQuality(0)).toBe('in-tune')
    expect(tuneQuality(10)).toBe('in-tune')
    expect(tuneQuality(-10)).toBe('in-tune')
    expect(tuneQuality(10.1)).toBe('close')
    expect(tuneQuality(-25)).toBe('close')
    expect(tuneQuality(26)).toBe('off')
  })
})

describe('levelPercent', () => {
  it('maps −60…0 dBFS onto 0…100', () => {
    expect(levelPercent(0)).toBe(0)
    expect(levelPercent(0.001)).toBe(0)
    expect(levelPercent(0.01)).toBe(33)
    expect(levelPercent(1)).toBe(100)
    expect(levelPercent(2)).toBe(100)
  })
})

describe('formatCents', () => {
  it('shows a sign and rounds', () => {
    expect(formatCents(3.4)).toBe('+3¢')
    expect(formatCents(-12.6)).toBe('-13¢')
    expect(formatCents(-0.2)).toBe('0¢')
  })
})
