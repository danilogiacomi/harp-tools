/** Spec §6 Reed voice: the first five harmonics of a free reed. */
export const REED_PARTIALS: readonly { multiple: number; gain: number }[] = [
  { multiple: 1, gain: 1 },
  { multiple: 2, gain: 0.55 },
  { multiple: 3, gain: 0.35 },
  { multiple: 4, gain: 0.2 },
  { multiple: 5, gain: 0.12 },
]

/** The Reed voice's gentle low-pass sits at this multiple of the fundamental. */
export const REED_LOWPASS_MULTIPLE = 5
export const REED_ATTACK_S = 0.035
export const PURE_ATTACK_S = 0.02

/** The breath at a Reed note's onset: band-passed noise that fades out on its own. */
export const BREATH = { centerHz: 2000, q: 1, peak: 0.05, decayS: 0.06, stopS: 0.07 } as const

/** The frequencies a Reed note sounds: exact multiples of `freq`, the fundamental first. */
export function reedFrequencies(freq: number): number[] {
  return REED_PARTIALS.map((p) => freq * p.multiple)
}
