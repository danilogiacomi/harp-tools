import {
  scheduleAhead,
  type Click,
  type ClickKind,
  type MetronomeConfig,
  type SchedulerState,
} from '../core/rhythm/schedule'
import { audioEngine } from './AudioEngine'

const TICK_MS = 25
const LOOKAHEAD_S = 0.1
const START_DELAY_S = 0.05

const CLICK_SOUND: Record<ClickKind, { freq: number; gain: number }> = {
  bar: { freq: 1600, gain: 0.6 },
  group: { freq: 1250, gain: 0.45 },
  beat: { freq: 1000, gain: 0.35 },
  sub: { freq: 800, gain: 0.15 },
}

export type BeatListener = (pulse: number, kind: ClickKind) => void

/**
 * Look-ahead scheduler: a coarse JS timer schedules clicks slightly ahead on the precise
 * audio clock, so timing stays tight even when the main thread is busy.
 */
export class Metronome {
  private timer: ReturnType<typeof setInterval> | undefined
  private state: SchedulerState = { nextTime: 0, pulse: 0, sub: 0 }
  private pendingBeats = new Set<ReturnType<typeof setTimeout>>()

  constructor(
    private config: MetronomeConfig,
    private readonly onBeat: BeatListener,
  ) {}

  get isRunning(): boolean {
    return this.timer !== undefined
  }

  setConfig(config: MetronomeConfig): void {
    this.config = config
  }

  start(): void {
    if (this.isRunning) return
    this.state = { nextTime: audioEngine.now() + START_DELAY_S, pulse: 0, sub: 0 }
    this.tick()
    this.timer = setInterval(this.tick, TICK_MS)
  }

  stop(): void {
    clearInterval(this.timer)
    this.timer = undefined
    this.pendingBeats.forEach(clearTimeout)
    this.pendingBeats.clear()
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
    const { freq, gain } = CLICK_SOUND[click.kind]
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.frequency.value = freq
    env.gain.setValueAtTime(gain, click.time)
    env.gain.exponentialRampToValueAtTime(0.001, click.time + 0.04)
    osc.connect(env).connect(audioEngine.master)
    osc.start(click.time)
    osc.stop(click.time + 0.05)
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
