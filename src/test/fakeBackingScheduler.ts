import type { BackingConfig } from '../core/jam/backingSchedule'

/**
 * Stand-in for the band in hook and page tests:
 *   vi.mock('../../../audio/backing/BackingScheduler', () => import('../../../test/fakeBackingScheduler'))
 * Tests read what was asked of the band, and play its bars by calling `fakeBand.onBar(n)`.
 */
export const fakeBand = {
  onBar: null as ((bar: number) => void) | null,
  config: null as BackingConfig | null,
  a4: 0,
  running: false,
  starts: 0,
  stops: 0,
  disposes: 0,
  reset() {
    this.onBar = null
    this.config = null
    this.a4 = 0
    this.running = false
    this.starts = 0
    this.stops = 0
    this.disposes = 0
  },
}

export class BackingScheduler {
  constructor(config: BackingConfig, onBar: (bar: number) => void) {
    fakeBand.config = config
    fakeBand.onBar = onBar
  }

  get isRunning(): boolean {
    return fakeBand.running
  }

  setConfig(config: BackingConfig): void {
    fakeBand.config = config
  }

  setA4(a4: number): void {
    fakeBand.a4 = a4
  }

  start(): void {
    fakeBand.running = true
    fakeBand.starts++
  }

  stop(): void {
    fakeBand.running = false
    fakeBand.stops++
  }

  dispose(): void {
    fakeBand.running = false
    fakeBand.disposes++
  }
}
