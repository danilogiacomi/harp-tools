import {
  scheduleAhead,
  type Click,
  type ClickKind,
  type MetronomeConfig,
  type SchedulerState,
} from '../core/rhythm/schedule'
import { audioEngine } from './AudioEngine'
import { screenAwake, type KeepAwake } from './screenAwake'
import { clickSamples } from './click'

const TICK_MS = 25
const LOOKAHEAD_S = 0.1
const START_DELAY_S = 0.05

export type BeatListener = (pulse: number, kind: ClickKind) => void

/**
 * Look-ahead scheduler: a coarse JS timer schedules clicks slightly ahead on the precise
 * audio clock, so timing stays tight even when the main thread is busy.
 */
export class Metronome {
  private timer: ReturnType<typeof setInterval> | undefined
  private state: SchedulerState = { nextTime: 0, pulse: 0, sub: 0 }
  private pendingBeats = new Set<ReturnType<typeof setTimeout>>()
  private clicks: {
    ctx: BaseAudioContext
    buffers: Partial<Record<ClickKind, AudioBuffer>>
  } | null = null
  private releaseScreen: (() => void) | null = null

  constructor(
    private config: MetronomeConfig,
    private readonly onBeat: BeatListener,
    private readonly awake: KeepAwake = screenAwake,
  ) {}

  get isRunning(): boolean {
    return this.timer !== undefined
  }

  setConfig(config: MetronomeConfig): void {
    this.config = config
  }

  start(): void {
    if (this.isRunning) return
    this.releaseScreen = this.awake.hold()
    this.state = { nextTime: audioEngine.now() + START_DELAY_S, pulse: 0, sub: 0 }
    this.tick()
    this.timer = setInterval(this.tick, TICK_MS)
  }

  stop(): void {
    clearInterval(this.timer)
    this.timer = undefined
    this.pendingBeats.forEach(clearTimeout)
    this.pendingBeats.clear()
    this.releaseScreen?.()
    this.releaseScreen = null
  }

  private tick = (): void => {
    const ctx = audioEngine.ctx
    const { clicks, state } = scheduleAhead(this.state, this.config, ctx.currentTime, LOOKAHEAD_S)
    this.state = state
    for (const click of clicks) {
      this.playClick(ctx, click)
      if (click.kind !== 'sub') this.notifyAt(ctx, click)
    }
  }

  private playClick(ctx: AudioContext, click: Click): void {
    const src = ctx.createBufferSource()
    src.buffer = this.clickBuffer(ctx, click.kind)
    src.connect(audioEngine.master)
    src.start(click.time)
  }

  /** Each kind's click is rendered once per audio context (see click.ts). */
  private clickBuffer(ctx: BaseAudioContext, kind: ClickKind): AudioBuffer {
    if (this.clicks?.ctx !== ctx) this.clicks = { ctx, buffers: {} }
    const cached = this.clicks.buffers[kind]
    if (cached) return cached
    const samples = clickSamples(kind, ctx.sampleRate)
    const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate)
    buffer.getChannelData(0).set(samples)
    this.clicks.buffers[kind] = buffer
    return buffer
  }

  /** Fire the UI callback when the click is actually heard. */
  private notifyAt(ctx: AudioContext, click: Click): void {
    const delayMs = Math.max(0, (click.time - ctx.currentTime) * 1000)
    const id = setTimeout(() => {
      this.pendingBeats.delete(id)
      this.onBeat(click.pulse, click.kind)
    }, delayMs)
    this.pendingBeats.add(id)
  }
}
