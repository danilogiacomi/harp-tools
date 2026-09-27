export function mean(values: readonly number[]): number {
  if (values.length === 0) throw new Error('mean: no values')
  return values.reduce((a, b) => a + b, 0) / values.length
}

/** The middle value, or the mean of the two middle ones. */
export function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error('median: no values')
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Population standard deviation (σ). */
export function stdDev(values: readonly number[]): number {
  const m = mean(values)
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)))
}
