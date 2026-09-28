import { act, render, screen, within } from '@testing-library/react'
import { Profiler } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PitchListener } from '../../../audio/pitch/PitchDetector'
import { midiToFreq } from '../../../core/music/pitch'
import type { PitchState } from '../../hooks/usePitch'
import { SettingsProvider } from '../../settings/SettingsContext'
import { layoutShape } from '../../../test/layout'
import { STATS_REFRESH_MS, ToneMeter } from './ToneMeterPage'

// A static mic state: frames only arrive through the listener, so any re-render the test sees
// comes from the page itself.
const mic = vi.hoisted(() => ({
  listener: null as PitchListener | null,
  state: { reading: null, rms: 0, status: 'listening', error: null } as PitchState,
}))
vi.mock('../../hooks/usePitch', () => ({
  usePitch: (_enabled: boolean, onReading: PitchListener) => {
    mic.listener = onReading
    return mic.state
  },
}))

const clock = { t: 0 }
/** Plays `midi` `cents` off at `rms` (null = silence) every 20 ms for `ms`. */
const play = (midi: number | null, ms: number, cents = 0, rms = 0.1) => {
  for (let elapsed = 0; elapsed < ms; elapsed += 20) {
    clock.t += 20
    const reading =
      midi === null ? null : { freq: midiToFreq(midi) * 2 ** (cents / 1200), clarity: 1, rms }
    mic.listener?.(reading, rms)
  }
}
const stat = (name: string) => {
  const dts = within(screen.getByLabelText('Held note')).getAllByRole('term')
  const dt = dts.find((d) => d.textContent === name)!
  return dt.nextElementSibling!.textContent
}

describe('ToneMeter', () => {
  let commits = 0
  const renderMeter = () =>
    render(
      <SettingsProvider storage={null}>
        <Profiler id="tone" onRender={() => commits++}>
          <ToneMeter now={() => clock.t} />
        </Profiler>
      </SettingsProvider>,
    )

  beforeEach(() => {
    vi.useFakeTimers()
    clock.t = 0
    commits = 0
  })
  afterEach(() => vi.useRealTimers())

  it('shows the held note’s stats, refreshed a few times a second', () => {
    renderMeter()
    expect(stat('Note')).toBe('–')
    act(() => play(67, 1200, 5))
    expect(stat('Note')).toBe('–')
    act(() => vi.advanceTimersByTime(STATS_REFRESH_MS))
    expect(stat('Note')).toBe('G4 (-2 or 3)')
    expect(stat('Hold time')).toBe('1.2 s')
    expect(stat('Pitch steadiness')).toBe('±0.0¢')
    expect(stat('Average level')).toBe('-20 dB')
    expect(stat('Vibrato')).toBe('None')
  })

  it('does not re-render for mic frames, only for the stats refresh', () => {
    renderMeter()
    const before = commits
    act(() => play(67, 1000))
    expect(commits).toBe(before)
    act(() => vi.advanceTimersByTime(STATS_REFRESH_MS))
    expect(commits).toBe(before + 1)
  })

  it('draws the pitch and level lines on animation frames', () => {
    const { container } = renderMeter()
    act(() => play(67, 500, 10, 0.1))
    act(() => vi.advanceTimersByTime(100))
    expect(container.querySelector('path.pitch')!.getAttribute('d')).toMatch(/^M/)
    expect(container.querySelector('path.level')!.getAttribute('d')).toMatch(/^M/)
  })

  it('keeps drawing the level line when the pitch is unclear but breath is present', () => {
    const { container } = renderMeter()
    // No pitched reading (an attack, a breathy note…), but rms shows sound is still there.
    act(() => play(null, 500, 0, 0.1))
    act(() => vi.advanceTimersByTime(100))
    expect(container.querySelector('path.pitch')!.getAttribute('d')).toBe('')
    expect(container.querySelector('path.level')!.getAttribute('d')).toMatch(/^M/)
  })

  it('breaks the level line too on true silence', () => {
    const { container } = renderMeter()
    act(() => play(null, 500, 0, 0))
    act(() => vi.advanceTimersByTime(100))
    expect(container.querySelector('path.level')!.getAttribute('d')).toBe('')
  })

  it('keeps the same layout with and without a note', () => {
    const { container } = renderMeter()
    const shape = () => layoutShape(container, ['dt', 'dd', 'svg', 'p'])
    const empty = shape()
    act(() => play(67, 1200))
    act(() => vi.advanceTimersByTime(STATS_REFRESH_MS))
    expect(shape()).toEqual(empty)
  })
})
