export type TuneQuality = 'in-tune' | 'close' | 'off'

export function tuneQuality(cents: number): TuneQuality {
  const a = Math.abs(cents)
  if (a <= 10) return 'in-tune'
  if (a <= 25) return 'close'
  return 'off'
}

/** Linear RMS → 0–100 on a −60…0 dBFS scale. */
export function levelPercent(rms: number): number {
  if (rms <= 0) return 0
  const db = 20 * Math.log10(rms)
  return Math.round(Math.min(100, Math.max(0, ((db + 60) / 60) * 100)))
}

export function formatCents(cents: number): string {
  const r = Math.round(cents) || 0 // avoid "-0"
  return r > 0 ? `+${r}¢` : `${r}¢`
}
