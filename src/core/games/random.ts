/** A float in [0, 1), like Math.random. Game logic takes one so tests can script it. */
export type Rng = () => number

/** Small seeded PRNG (mulberry32), for reproducible tests. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Replays `values` in order, starting over at the end. For tests. */
export function scriptedRng(values: readonly number[]): Rng {
  let i = 0
  return () => values[i++ % values.length]
}

export function pickOne<T>(items: readonly T[], rng: Rng): T {
  if (items.length === 0) throw new Error('pickOne: empty list')
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))]
}

export function weightedIndex(weights: readonly number[], rng: Rng): number {
  const total = weights.reduce((sum, w) => sum + w, 0)
  let r = rng() * total
  for (let i = 0; i < weights.length; i++) {
    if (r < weights[i]) return i
    r -= weights[i]
  }
  return weights.length - 1
}
