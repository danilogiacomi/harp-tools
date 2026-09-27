import { describe, expect, it } from 'vitest'
import { buildHarp, tabLabel } from '../harmonica/harp'
import {
  DEFAULT_POOL_FILTER,
  buildPool,
  poolLabel,
  techniqueGroup,
  uniqueMidis,
  type PoolFilter,
} from './notePool'

const c = buildHarp('C')
const filter = (patch: Partial<PoolFilter>): PoolFilter => ({ ...DEFAULT_POOL_FILTER, ...patch })

describe('techniqueGroup', () => {
  it('groups techniques as the filter panel shows them', () => {
    expect(techniqueGroup('blow')).toBe('plain')
    expect(techniqueGroup('draw')).toBe('plain')
    expect(techniqueGroup('drawBend')).toBe('bends')
    expect(techniqueGroup('blowBend')).toBe('bends')
    expect(techniqueGroup('overblow')).toBe('over')
    expect(techniqueGroup('overdraw')).toBe('over')
  })
})

describe('buildPool', () => {
  it('filters by hole range', () => {
    const pool = buildPool(c, filter({ fromHole: 1, toHole: 3 }), false)
    expect(pool.map(tabLabel)).toEqual(['1', '-1', '2', '-2', '3', '-3'])
  })

  it('accepts a reversed hole range', () => {
    expect(buildPool(c, filter({ fromHole: 3, toHole: 1 }), false)).toEqual(
      buildPool(c, filter({ fromHole: 1, toHole: 3 }), false),
    )
  })

  it('filters by technique group', () => {
    expect(buildPool(c, filter({ groups: ['bends'] }), false)).toHaveLength(12)
    expect(buildPool(c, filter({ groups: ['over'] }), false)).toHaveLength(7)
    expect(buildPool(c, filter({ groups: ['plain', 'bends'] }), false)).toHaveLength(32)
  })

  it('includes advanced over-notes only when asked', () => {
    expect(buildPool(c, filter({ groups: ['over'] }), true)).toHaveLength(10)
  })

  it('can come out empty', () => {
    expect(buildPool(c, filter({ fromHole: 5, toHole: 5, groups: ['bends'] }), false)).toEqual([])
    expect(buildPool(c, filter({ fromHole: 7, toHole: 7, groups: ['bends'] }), false)).toEqual([])
    expect(buildPool(c, filter({ groups: [] }), false)).toEqual([])
  })
})

describe('uniqueMidis', () => {
  it('sorts and removes duplicate pitches (G4 is both -2 and 3)', () => {
    const midis = uniqueMidis(buildPool(c, DEFAULT_POOL_FILTER, false))
    expect(midis).toHaveLength(19)
    expect(midis.slice(0, 6)).toEqual([60, 62, 64, 67, 71, 72])
  })
})

describe('poolLabel', () => {
  it('describes the filter canonically', () => {
    expect(poolLabel(DEFAULT_POOL_FILTER)).toBe('1-10:plain')
    expect(poolLabel(filter({ fromHole: 6, toHole: 2, groups: ['over', 'plain'] }))).toBe(
      '2-6:plain+over',
    )
  })
})
