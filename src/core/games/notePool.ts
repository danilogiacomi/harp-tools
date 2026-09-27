import type { HarpNote, Hole, Technique } from '../harmonica/harp'

export type TechniqueGroup = 'plain' | 'bends' | 'over'

export const TECHNIQUE_GROUPS: readonly { id: TechniqueGroup; label: string }[] = [
  { id: 'plain', label: 'Blow / draw' },
  { id: 'bends', label: 'Bends' },
  { id: 'over', label: 'Overblows / overdraws' },
]

export function techniqueGroup(t: Technique): TechniqueGroup {
  switch (t) {
    case 'blow':
    case 'draw':
      return 'plain'
    case 'drawBend':
    case 'blowBend':
      return 'bends'
    case 'overblow':
    case 'overdraw':
      return 'over'
  }
}

export interface PoolFilter {
  fromHole: Hole
  toHole: Hole
  groups: readonly TechniqueGroup[]
}

export const DEFAULT_POOL_FILTER: PoolFilter = { fromHole: 1, toHole: 10, groups: ['plain'] }

/** Candidate target notes for a game. `includeAdvanced` follows the global showAdvanced setting. */
export function buildPool(
  harp: readonly HarpNote[],
  filter: PoolFilter,
  includeAdvanced: boolean,
): HarpNote[] {
  const lo = Math.min(filter.fromHole, filter.toHole)
  const hi = Math.max(filter.fromHole, filter.toHole)
  return harp.filter(
    (n) =>
      n.hole >= lo &&
      n.hole <= hi &&
      filter.groups.includes(techniqueGroup(n.technique)) &&
      (includeAdvanced || n.common),
  )
}

/** Distinct pitches, low to high — ear games ask for a pitch, not a particular hole. */
export function uniqueMidis(notes: readonly HarpNote[]): number[] {
  return [...new Set(notes.map((n) => n.midi))].sort((a, b) => a - b)
}

export function poolLabel(filter: PoolFilter): string {
  const lo = Math.min(filter.fromHole, filter.toHole)
  const hi = Math.max(filter.fromHole, filter.toHole)
  const groups = TECHNIQUE_GROUPS.map((g) => g.id).filter((id) => filter.groups.includes(id))
  return `${lo}-${hi}:${groups.join('+')}`
}
