import { Profiler } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PitchListener } from '../../../audio/pitch/PitchDetector'
import { midiToFreq } from '../../../core/music/pitch'
import { layoutShape } from '../../../test/layout'
import { HEALTH_KEY } from '../../health/healthStore'
import type { PitchState } from '../../hooks/usePitch'
import { SettingsProvider, useSettings } from '../../settings/SettingsContext'
import { HealthCheck } from './HealthCheckPage'

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
/** Plays `midi` `cents` off (null = silence) every 50 ms for `ms`, starting after the last frame. */
const play = (midi: number | null, ms: number, cents = 0) =>
  act(() => {
    for (let elapsed = 0; elapsed < ms; elapsed += 50) {
      clock.t += 50
      const freq = midi === null ? null : midiToFreq(midi) * 2 ** (cents / 1200)
      mic.listener?.(freq === null ? null : { freq, clarity: 1, rms: 0.1 }, 0.1)
    }
  })

function A4Readout() {
  const { settings } = useSettings()
  return <output aria-label="A4">{settings.a4}</output>
}

const renderCheck = () =>
  render(
    <SettingsProvider storage={null}>
      <A4Readout />
      <HealthCheck now={() => clock.t} storage={localStorage} />
    </SettingsProvider>,
  )
const cell = (technique: 'Blow' | 'Draw', hole: number) =>
  within(screen.getByRole('row', { name: new RegExp(`^${technique}`) })).getAllByRole('cell')[
    hole - 1
  ]
const skip = (n: number) => {
  for (let i = 0; i < n; i++) fireEvent.click(screen.getByRole('button', { name: /Skip reed/ }))
}

/** A controllable matchMedia: `set(true)` flips every query and fires 'change'. */
function stubMatchMedia(initial: boolean) {
  let matches = initial
  const listeners = new Set<() => void>()
  window.matchMedia = ((query: string) => ({
    get matches() {
      return matches
    },
    media: query,
    addEventListener: (_: 'change', l: () => void) => listeners.add(l),
    removeEventListener: (_: 'change', l: () => void) => listeners.delete(l),
  })) as unknown as typeof window.matchMedia
  return (next: boolean) => {
    matches = next
    listeners.forEach((l) => l())
  }
}

describe('HealthCheck', () => {
  beforeEach(() => {
    localStorage.clear()
    clock.t = 0
    mic.state = { reading: null, rms: 0, status: 'listening', error: null }
  })

  it('measures each reed after a steady second and moves on', () => {
    renderCheck()
    expect(screen.getByText('Play hole 1 blow (C4)')).toBeInTheDocument()
    play(60, 600, 12)
    expect(screen.getByText('+12¢ — hold it steady')).toBeInTheDocument()
    play(60, 500, 12)
    expect(cell('Blow', 1)).toHaveTextContent('+12¢')
    expect(cell('Blow', 1)).toHaveAttribute('data-quality', 'close')
    expect(screen.getByText('Play hole 1 draw (D4)')).toBeInTheDocument()
  })

  it('needs a break between reeds that share a pitch (2 draw and 3 blow are both G4)', () => {
    renderCheck()
    skip(3)
    expect(screen.getByText('Play hole 2 draw (G4)')).toBeInTheDocument()
    play(null, 100)
    play(67, 1100, -4)
    expect(cell('Draw', 2)).toHaveTextContent('-4¢')
    expect(screen.getByText('Play hole 3 blow (G4)')).toBeInTheDocument()
    play(67, 2000, -4)
    expect(cell('Blow', 3)).toHaveTextContent('–')
    expect(screen.getByText('Stop, then play the next reed.')).toBeInTheDocument()
    play(null, 100)
    play(67, 1100, 2)
    expect(cell('Blow', 3)).toHaveTextContent('+2¢')
  })

  it('skips and redoes reeds', () => {
    renderCheck()
    play(60, 1100, 30)
    expect(cell('Blow', 1)).toHaveAttribute('data-quality', 'off')
    fireEvent.click(screen.getByRole('button', { name: /Redo reed/ }))
    expect(cell('Blow', 1)).toHaveTextContent('–')
    expect(screen.getByText('Play hole 1 blow (C4)')).toBeInTheDocument()
    play(null, 100)
    play(60, 1100, 3)
    expect(cell('Blow', 1)).toHaveAttribute('data-quality', 'in-tune')
    skip(1)
    expect(cell('Draw', 1)).toHaveTextContent('–')
    expect(screen.getByText('Play hole 2 blow (E4)')).toBeInTheDocument()
  })

  it('summarises, suggests a matching A4 and saves the check', () => {
    renderCheck()
    const reeds = [60, 62, 64, 67, 67]
    reeds.forEach((midi) => {
      play(null, 100)
      play(midi, 1100, 8)
    })
    skip(15)
    expect(screen.getByText('✓ Check complete')).toBeInTheDocument()
    expect(screen.getByLabelText('Summary')).toHaveTextContent('Average offset +8¢.')
    expect(screen.getByText('5 of 20 reeds measured.')).toBeInTheDocument()
    const saved = JSON.parse(localStorage.getItem(HEALTH_KEY)!)['C|richter']
    expect(saved.a4).toBe(440)
    expect(saved.cents.slice(0, 6).map((c: number | null) => c && Math.round(c))).toEqual([
      8,
      8,
      8,
      8,
      8,
      null,
    ])
    fireEvent.click(screen.getByRole('button', { name: 'Use 442 Hz' }))
    expect(screen.getByLabelText('A4')).toHaveTextContent('442')
  })

  it('keeps a finished check when its A4 suggestion is applied, re-read at the new A4', () => {
    renderCheck()
    ;[60, 62, 64, 67, 67].forEach((midi) => {
      play(null, 100)
      play(midi, 1100, 8)
    })
    skip(15)
    expect(cell('Blow', 1)).toHaveTextContent('+8¢')
    fireEvent.click(screen.getByRole('button', { name: 'Use 442 Hz' }))
    expect(screen.getByLabelText('A4')).toHaveTextContent('442')
    expect(screen.getByText('✓ Check complete')).toBeInTheDocument()
    // +8¢ against 440 Hz is +0.15¢ against 442 Hz.
    expect(cell('Blow', 1)).toHaveTextContent('0¢')
    expect(cell('Draw', 2)).toHaveTextContent('0¢')
    expect(screen.getByText('5 of 20 reeds measured.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Use \d+ Hz/ })).toBeNull()
  })

  it('measures the rest of a check against an A4 applied part way', () => {
    renderCheck()
    ;[60, 62, 64, 67, 67].forEach((midi) => {
      play(null, 100)
      play(midi, 1100, 8)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Use 442 Hz' }))
    expect(screen.getByText('Play hole 3 draw (B4)')).toBeInTheDocument()
    expect(cell('Blow', 3)).toHaveTextContent('0¢')
    play(null, 100)
    play(71, 1100, 8) // +8¢ against 440 Hz
    expect(cell('Draw', 3)).toHaveTextContent('0¢')
  })

  it('compares with a previous check made at another A4', () => {
    localStorage.setItem(
      HEALTH_KEY,
      JSON.stringify({
        'C|richter': { date: '2026-09-20', a4: 442, cents: [2, ...Array(19).fill(null)] },
      }),
    )
    renderCheck()
    expect(screen.getByText(/Δ against the previous check \(2026-09-20\)/)).toBeInTheDocument()
    play(60, 1100, 4)
    // +2¢ at 442 Hz is +9.85¢ at 440 Hz.
    expect(cell('Blow', 1)).toHaveTextContent('+4¢Δ -6¢')
  })

  it('shows the change since the previous check at the same A4', () => {
    localStorage.setItem(
      HEALTH_KEY,
      JSON.stringify({
        'C|richter': { date: '2026-09-20', a4: 440, cents: [10, ...Array(19).fill(null)] },
      }),
    )
    renderCheck()
    expect(screen.getByText(/Δ against the previous check \(2026-09-20\)/)).toBeInTheDocument()
    play(60, 1100, 4)
    expect(cell('Blow', 1)).toHaveTextContent('+4¢Δ -6¢')
  })

  it('keeps the same layout from the first reed to the end', () => {
    const { container } = renderCheck()
    const shape = () =>
      layoutShape(container, ['table', 'tbody tr', 'td', '[aria-label="Summary"] > p'])
    const start = shape()
    expect(start.stageRows).toHaveLength(3)
    play(60, 500)
    expect(shape()).toEqual(start)
    skip(20)
    expect(screen.getByText('✓ Check complete')).toBeInTheDocument()
    expect(shape()).toEqual(start)
  })

  it('does not re-render on mic frames that change nothing shown', () => {
    const onRender = vi.fn()
    render(
      <SettingsProvider storage={null}>
        <Profiler id="check" onRender={onRender}>
          <HealthCheck now={() => clock.t} storage={localStorage} />
        </Profiler>
      </SettingsProvider>,
    )
    const frame = (midi: number | null) =>
      act(() => {
        clock.t += 50
        mic.listener?.(midi === null ? null : { freq: midiToFreq(midi), clarity: 1, rms: 0.1 }, 0.1)
      })
    frame(null)
    let count = onRender.mock.calls.length
    for (let i = 0; i < 20; i++) frame(null)
    expect(onRender).toHaveBeenCalledTimes(count)
    frame(72) // an octave above hole 1 blow: outside the ±60¢ window
    count = onRender.mock.calls.length
    for (let i = 0; i < 20; i++) frame(72)
    expect(onRender).toHaveBeenCalledTimes(count)
  })

  it('shows mic errors', () => {
    mic.state = { reading: null, rms: 0, status: 'error', error: 'denied' }
    renderCheck()
    expect(screen.getByRole('alert')).toHaveTextContent('Microphone permission was denied')
  })
})

describe('HealthCheck table on a phone', () => {
  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia
  })

  it('lists holes as rows with Blow and Draw columns', () => {
    stubMatchMedia(true)
    renderCheck()
    const table = screen.getByRole('table')
    expect(table).toHaveAttribute('data-layout', 'narrow')
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent)
    expect(headers).toEqual(['Hole', 'Blow', 'Draw'])
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((h) => h.textContent),
    ).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'])
  })

  it('keeps the wide layout on larger screens', () => {
    stubMatchMedia(false)
    renderCheck()
    expect(screen.getByRole('table')).toHaveAttribute('data-layout', 'wide')
  })
})
