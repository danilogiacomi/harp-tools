import { midiToFreq } from '../core/music/pitch'
import { audioEngine } from './AudioEngine'
import type { NotePlayer } from './NotePlayer'

const PEAK = 0.25
const ATTACK_S = 0.02
const RELEASE_S = 0.08

interface Voice {
  oscillators: OscillatorNode[]
  envelope: GainNode
}

/** Sawtooth + triangle through a low-pass filter: a reed-ish tone rather than a beep. */
export class SynthNotePlayer implements NotePlayer {
  private voice: Voice | null = null
  private a4: () => number
  private soundingListeners = new Set<(sounding: boolean) => void>()

  constructor(a4: () => number) {
    this.a4 = a4
  }

  get isSounding(): boolean {
    return this.voice !== null
  }

  /** Swaps the A4 getter, e.g. when a caller can't safely hand a ref-reading closure to the
   * constructor during render; lets it update the getter later from an effect instead. */
  setA4Getter(a4: () => number): void {
    this.a4 = a4
  }

  onSoundingChange(listener: (sounding: boolean) => void): () => void {
    this.soundingListeners.add(listener)
    return () => {
      this.soundingListeners.delete(listener)
    }
  }

  start(midi: number): void {
    const wasSounding = this.voice !== null
    this.release()
    const ctx = audioEngine.ctx
    const t = ctx.currentTime
    const freq = midiToFreq(midi, this.a4())

    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0, t)
    envelope.gain.linearRampToValueAtTime(PEAK, t + ATTACK_S)
    envelope.connect(audioEngine.master)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = Math.min(freq * 4, 8000)
    filter.Q.value = 1
    filter.connect(envelope)

    const oscillators = (['sawtooth', 'triangle'] as const).map((type, i) => {
      const osc = ctx.createOscillator()
      osc.type = type
      osc.frequency.value = freq
      const mix = ctx.createGain()
      mix.gain.value = i === 0 ? 0.35 : 0.65
      osc.connect(mix).connect(filter)
      osc.start(t)
      return osc
    })
    oscillators[0].onended = () => envelope.disconnect()

    this.voice = { oscillators, envelope }
    if (!wasSounding) this.soundingListeners.forEach((l) => l(true))
  }

  stop(): void {
    if (!this.voice) return
    this.release()
    this.soundingListeners.forEach((l) => l(false))
  }

  /** Fades the current voice out without telling listeners (start() uses it to swap notes). */
  private release(): void {
    const voice = this.voice
    if (!voice) return
    this.voice = null
    const t = audioEngine.ctx.currentTime
    const gain = voice.envelope.gain
    gain.cancelScheduledValues(t)
    gain.setValueAtTime(gain.value, t)
    gain.linearRampToValueAtTime(0, t + RELEASE_S)
    voice.oscillators.forEach((o) => o.stop(t + RELEASE_S + 0.02))
  }

  play(midi: number, { durationMs = 1000 }: { durationMs?: number } = {}): Promise<void> {
    this.start(midi)
    const voice = this.voice
    return new Promise((resolve) =>
      setTimeout(() => {
        if (this.voice === voice) this.stop()
        resolve()
      }, durationMs),
    )
  }
}
