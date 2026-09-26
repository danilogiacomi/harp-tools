import { describe, expect, it } from 'vitest'
import { parseHash } from './router'

describe('parseHash', () => {
  it('normalises hashes to paths', () => {
    expect(parseHash('')).toBe('/')
    expect(parseHash('#')).toBe('/')
    expect(parseHash('#/')).toBe('/')
    expect(parseHash('#/tuner')).toBe('/tuner')
    expect(parseHash('#tuner')).toBe('/tuner')
    expect(parseHash('#/tuner?x=1')).toBe('/tuner')
  })
})
