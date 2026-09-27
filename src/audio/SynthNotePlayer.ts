import { midiToFreq } from '../core/music/pitch'
import { audioEngine } from './AudioEngine'
import type { NotePlayer, SoundVoice } from './NotePlayer'
import {
  BREATH,
  PURE_ATTACK_S,
  REED_ATTACK_S,
  REED_LOWPASS_MULTIPLE,
  REED_PARTIALS,
  reedFrequencies,
} from './voices'

const PEAK = 0.25
const RELEASE_S = 0.08
const NOISE_SECONDS = 0.1
const REED_TOTAL_GAIN = REED_PARTIALS.reduce((sum, p) => sum + p.gain, 0)

interface Voice {
  oscillators: OscillatorNode[]
  envelope: GainNode
}

/**
 * The reference-note synth (spec §6). "Reed": additive harmonics plus a breath at the onset.
 * "Pure": sawtooth + triangle through a low-pass. Either way the fundamental is exact.
 */
export class SynthNotePlayer implements NotePlayer {
  private voice: Voice | null = null
  private a4: () => number
  private sound: SoundVoice
  private noise: { ctx: AudioContext; buffer: AudioBuffer } | null = null
  private soundingListeners = new Set<(sounding: boolean) => void>()

  constructor(a4: () => number, sound: SoundVoice = 'reed') {
    this.a4 = a4
    this.sound = sound
  }

  get isSounding(): boolean {
    return this.voice !== null
  }

  /** Swaps the A4 getter, e.g. when a caller can't safely hand a ref-reading closure to the
   * constructor during render; lets it update the getter later from an effect instead. */
  setA4Getter(a4: () => number): void {
    this.a4 = a4
  }

  /** Changes the voice for the next note; a sounding note keeps its voice. */
  setSound(sound: SoundVoice): void {
    this.sound = sound
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
    const reed = this.sound === 'reed'

    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0, t)
    envelope.gain.linearRampToValueAtTime(PEAK, t + (reed ? REED_ATTACK_S : PURE_ATTACK_S))
    envelope.connect(audioEngine.master)

    const oscillators = reed
      ? this.reedOscillators(ctx, freq, t, envelope)
      : this.pureOscillators(ctx, freq, t, envelope)
    oscillators[0].onended = () => envelope.disconnect()
    if (reed) this.breath(ctx, t)

    this.voice = { oscillators, envelope }
    if (!wasSounding) this.soundingListeners.forEach((l) => l(true))
  }

  stop(): void {
    if (!this.voice) return
    this.release()
    this.soundingListeners.forEach((l) => l(false))
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

  private pureOscillators(
    ctx: AudioContext,
    freq: number,
    t: number,
    out: AudioNode,
  ): OscillatorNode[] {
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = Math.min(freq * 4, 8000)
    filter.Q.value = 1
    filter.connect(out)
    return (['sawtooth', 'triangle'] as const).map((type, i) => {
      const osc = ctx.createOscillator()
      osc.type = type
      osc.frequency.value = freq
      const mix = ctx.createGain()
      mix.gain.value = i === 0 ? 0.35 : 0.65
      osc.connect(mix).connect(filter)
      osc.start(t)
      return osc
    })
  }

  private reedOscillators(
    ctx: AudioContext,
    freq: number,
    t: number,
    out: AudioNode,
  ): OscillatorNode[] {
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = Math.min(freq * REED_LOWPASS_MULTIPLE, 12000)
    filter.Q.value = 0.5
    filter.connect(out)
    const frequencies = reedFrequencies(freq)
    return REED_PARTIALS.map((partial, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = frequencies[i]
      const mix = ctx.createGain()
      mix.gain.value = partial.gain / REED_TOTAL_GAIN
      osc.connect(mix).connect(filter)
      osc.start(t)
      return osc
    })
  }

  /** A fire-and-forget noise burst: it fades out and stops by itself. */
  private breath(ctx: AudioContext, t: number): void {
    const source = ctx.createBufferSource()
    source.buffer = this.noiseBuffer(ctx)
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = BREATH.centerHz
    band.Q.value = BREATH.q
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(BREATH.peak, t)
    gain.gain.linearRampToValueAtTime(0, t + BREATH.decayS)
    source.connect(band).connect(gain).connect(audioEngine.master)
    source.start(t)
    source.stop(t + BREATH.stopS)
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noise && this.noise.ctx === ctx) return this.noise.buffer
    const length = Math.ceil(ctx.sampleRate * NOISE_SECONDS)
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
    this.noise = { ctx, buffer }
    return buffer
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
}
