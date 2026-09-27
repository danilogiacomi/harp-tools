import { scaleOctave, type Scale } from '../music/scales'
import type { HarpNote, Technique } from './harp'
import { keyOffset, type HarpKey } from './keys'

export type Position = 1 | 2 | 3
export const POSITIONS: readonly Position[] = [1, 2, 3]

/** Tonic pitch class (0 = C) for `key` played in `position`: each position is a fifth higher. */
export function positionRootPc(key: HarpKey, position: Position): number {
  return (((keyOffset(key) + 7 * (position - 1)) % 12) + 12) % 12
}

export interface PathOptions {
  /** Allow overblows and overdraws in the path. */
  includeOver: boolean
  /** Allow over-notes marked `common: false`. */
  showAdvanced: boolean
}

/** 0 = plain blow/draw, 1 = bend, 2 = over-note. Lower is easier. */
const DIFFICULTY: Record<Technique, number> = {
  blow: 0,
  draw: 0,
  drawBend: 1,
  blowBend: 1,
  overblow: 2,
  overdraw: 2,
}

/** The easiest way to play `midi`: plain, then fewest bend steps, then over-note; lower hole on ties. */
export function pickNote(
  harp: readonly HarpNote[],
  midi: number,
  opts: PathOptions,
): HarpNote | null {
  const candidates = harp.filter(
    (n) =>
      n.midi === midi &&
      (opts.showAdvanced || n.common) &&
      (opts.includeOver || DIFFICULTY[n.technique] < 2),
  )
  candidates.sort(
    (a, b) =>
      DIFFICULTY[a.technique] - DIFFICULTY[b.technique] ||
      a.bendSteps - b.bendSteps ||
      a.hole - b.hole,
  )
  return candidates[0] ?? null
}

/** Every root-to-root octave of the scale that is fully playable on this harp, low to high. */
export function scaleOctaves(
  harp: readonly HarpNote[],
  key: HarpKey,
  scale: Scale,
  position: Position,
  opts: PathOptions,
): HarpNote[][] {
  if (harp.length === 0) return []
  const midis = harp.map((n) => n.midi)
  const lowest = Math.min(...midis)
  const highest = Math.max(...midis)
  const pc = positionRootPc(key, position)
  const octaves: HarpNote[][] = []
  for (let root = lowest + ((((pc - lowest) % 12) + 12) % 12); root + 12 <= highest; root += 12) {
    const notes = scaleOctave(root, scale).map((m) => pickNote(harp, m, opts))
    if (notes.every((n): n is HarpNote => n !== null)) octaves.push(notes)
  }
  return octaves
}

/** Index of the octave with the fewest bends and over-notes (the lowest one on ties). */
export function easiestOctave(octaves: readonly (readonly HarpNote[])[]): number {
  let best = 0
  let bestCost = Infinity
  octaves.forEach((octave, i) => {
    const cost = octave.filter((n) => DIFFICULTY[n.technique] > 0).length
    if (cost < bestCost) {
      best = i
      bestCost = cost
    }
  })
  return best
}

export type Direction = 'up' | 'down' | 'upDown'

export function runSequence<T>(path: readonly T[], direction: Direction): T[] {
  switch (direction) {
    case 'up':
      return [...path]
    case 'down':
      return [...path].reverse()
    case 'upDown':
      return [...path, ...path.slice(0, -1).reverse()]
  }
}
