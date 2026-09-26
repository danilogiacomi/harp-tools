const A4_MIDI = 69

export function midiToFreq(midi: number, a4 = 440): number {
  return a4 * 2 ** ((midi - A4_MIDI) / 12)
}

/** Nearest MIDI note to `freq`, plus how far off it is in cents (−50…+50). */
export function freqToMidi(freq: number, a4 = 440): { midi: number; cents: number } {
  const exact = A4_MIDI + 12 * Math.log2(freq / a4)
  const midi = Math.round(exact)
  return { midi, cents: (exact - midi) * 100 }
}

export function centsOff(freq: number, midi: number, a4 = 440): number {
  return 1200 * Math.log2(freq / midiToFreq(midi, a4))
}
