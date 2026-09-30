import {
  INSTRUMENTS,
  scheduleBacking,
  type BackingConfig,
  type BackingEvent,
  type BackingState,
  type Instrument,
} from '../../core/jam/backingSchedule'
import { midiToFreq } from '../../core/music/pitch'
import { audioEngine } from '../AudioEngine'
import { screenAwake, type KeepAwake } from '../screenAwake'
import { makeNoiseBuffer, playBass, playChord, playHat, playKick, playSnare } from './voices'

const TICK_MS = 25
const LOOKAHEAD_S = 0.1
const START_DELAY_S = 0.05
/** Mixer changes glide over ~10 ms instead of jumping, which would click. */
const GLIDE_S = 0.01

export interface MixLevel {
  /** 0–1. */
  volume: number
  muted: boolean
}

export type Mix = Record<Instrument, MixLevel>

export const DEFAULT_MIX: Mix = {
  kick: { volume: 0.8, muted: false },
  snare: { volume: 0.6, muted: false },
  hat: { volume: 0.4, muted: false },
  bass: { volume: 0.8, muted: false },
  chords: { volume: 0.5, muted: false },
}

export type BarListener = (bar: number) => void

/**
 * The backing track: the metronome's look-ahead pattern (a coarse timer schedules each beat
 * slightly ahead on the audio clock), feeding one mixer channel per instrument.
 */
export class BackingScheduler {
  private timer: ReturnType<typeof setInterval> | undefined
  private state: BackingState = { nextBeatTime: 0, bar: 0, beat: 0 }
  private pendingBars = new Set<ReturnType<typeof setTimeout>>()
  private channels: Record<Instrument, GainNode> | null = null
  private noise: AudioBuffer | null = null
  private a4 = 440
  private releaseScreen: (() => void) | null = null

  constructor(
    private config: BackingConfig,
    private readonly onBar: BarListener,
    private mix: Mix = DEFAULT_MIX,
    private readonly awake: KeepAwake = screenAwake,
  ) {}

  get isRunning(): boolean {
    return this.timer !== undefined
  }

  setConfig(config: BackingConfig): void {
    this.config = config
  }

  setA4(a4: number): void {
    this.a4 = a4
  }

  setMix(mix: Mix): void {
    this.mix = mix
    if (this.channels && this.isRunning) this.applyMix(this.channels)
  }

  start(): void {
    if (this.isRunning) return
    const ctx = audioEngine.ctx
    if (!this.channels) {
      const channels = {} as Record<Instrument, GainNode>
      for (const i of INSTRUMENTS) {
        channels[i] = ctx.createGain()
        channels[i].gain.value = 0 // faded in by applyMix()
        channels[i].connect(audioEngine.master)
      }
      this.channels = channels
    }
    this.applyMix(this.channels)
    this.noise ??= makeNoiseBuffer(ctx)
    this.state = { nextBeatTime: audioEngine.now() + START_DELAY_S, bar: 0, beat: 0 }
    this.tick()
    this.timer = setInterval(this.tick, TICK_MS)
    this.releaseScreen = this.awake.hold()
  }

  /** Stops scheduling and fades out the notes already scheduled ahead. */
  stop(): void {
    clearInterval(this.timer)
    this.timer = undefined
    this.pendingBars.forEach(clearTimeout)
    this.pendingBars.clear()
    this.releaseScreen?.()
    this.releaseScreen = null
    if (this.channels) {
      for (const i of INSTRUMENTS) this.glide(this.channels[i], 0)
    }
  }

  /** Stops and disconnects the mixer; a later start() builds a new one. */
  dispose(): void {
    this.stop()
    if (this.channels) {
      for (const i of INSTRUMENTS) this.channels[i].disconnect()
    }
    this.channels = null
  }

  private applyMix(channels: Record<Instrument, GainNode>): void {
    for (const i of INSTRUMENTS) {
      const { volume, muted } = this.mix[i]
      this.glide(channels[i], muted ? 0 : volume)
    }
  }

  private glide(channel: GainNode, value: number): void {
    channel.gain.setTargetAtTime(value, audioEngine.ctx.currentTime, GLIDE_S)
  }

  private tick = (): void => {
    const ctx = audioEngine.ctx
    const { events, state } = scheduleBacking(this.state, this.config, ctx.currentTime, LOOKAHEAD_S)
    this.state = state
    for (const e of events) this.play(ctx, e)
  }

  private play(ctx: AudioContext, e: BackingEvent): void {
    const ch = this.channels
    const noise = this.noise
    if (!ch || !noise) return
    switch (e.kind) {
      case 'kick':
        return playKick(ctx, ch.kick, e.time)
      case 'snare':
        return playSnare(ctx, ch.snare, e.time, noise)
      case 'hat':
        return playHat(ctx, ch.hat, e.time, noise)
      case 'bass':
        return playBass(ctx, ch.bass, e.time, midiToFreq(e.midi, this.a4), e.duration)
      case 'chords':
        return playChord(
          ctx,
          ch.chords,
          e.time,
          e.midis.map((m) => midiToFreq(m, this.a4)),
          e.duration,
        )
      case 'bar':
        return this.notifyAt(ctx, e.time, e.bar)
    }
  }

  /** Tells the page about the new bar when it is actually heard. */
  private notifyAt(ctx: AudioContext, time: number, bar: number): void {
    const delayMs = Math.max(0, (time - ctx.currentTime) * 1000)
    const id = setTimeout(() => {
      this.pendingBars.delete(id)
      this.onBar(bar)
    }, delayMs)
    this.pendingBars.add(id)
  }
}
