import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { Profiler } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mix } from '../../../audio/backing/BackingScheduler'
import type { PitchListener } from '../../../audio/pitch/PitchDetector'
import type { BackingConfig } from '../../../core/jam/backingSchedule'
import { midiToFreq } from '../../../core/music/pitch'
import type { PitchState } from '../../hooks/usePitch'
import { layoutShape } from '../../../test/layout'
import { SettingsProvider } from '../../settings/SettingsContext'
import { Jam } from './JamPage'

const backing = vi.hoisted(() => ({
  running: false,
  bar: null as number | null,
  toggle: vi.fn(),
  config: null as BackingConfig | null,
  mix: null as Mix | null,
}))
vi.mock('../../hooks/useBacking', () => ({
  useBacking: (config: BackingConfig, mix: Mix) => {
    backing.config = config
    backing.mix = mix
    return { running: backing.running, bar: backing.bar, toggle: backing.toggle }
  },
}))
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

let commits = 0
const renderJam = () =>
  render(
    <SettingsProvider storage={null}>
      <Profiler id="jam" onRender={() => commits++}>
        <Jam />
      </Profiler>
    </SettingsProvider>,
  )
const cell = (name: string) => screen.getByRole('button', { name })

describe('Jam', () => {
  beforeEach(() => {
    backing.running = false
    backing.bar = null
    backing.toggle.mockClear()
    mic.listener = null
    commits = 0
  })

  it('plays G blues on a C harp: chord tones on target, the rest of the scale as hints', () => {
    renderJam()
    expect(backing.config).toMatchObject({ bpm: 90, feel: 'shuffle', tonicPc: 7 })
    expect(screen.getByLabelText('Current chord')).toHaveTextContent('G7')
    expect(cell('-2 G4')).toHaveAttribute('data-highlight', 'target')
    expect(cell('-3 B4')).toHaveAttribute('data-highlight', 'target')
    expect(cell("-3' A#4")).toHaveAttribute('data-highlight', 'hint')
    expect(cell('4 C5')).toHaveAttribute('data-highlight', 'hint')
    expect(cell('5 E5')).not.toHaveAttribute('data-highlight')
    fireEvent.click(screen.getByRole('button', { name: '▶ Play' }))
    expect(backing.toggle).toHaveBeenCalled()
  })

  it('follows the bar: the chord, the form strip and the chart', () => {
    backing.running = true
    backing.bar = 4
    renderJam()
    expect(screen.getByText('Bar 5/12')).toBeInTheDocument()
    const strip = within(screen.getByRole('list', { name: '12-bar form' })).getAllByRole('listitem')
    expect(strip.map((li) => li.textContent).join(' ')).toBe('G7 G7 G7 G7 C7 C7 G7 G7 D7 C7 G7 D7')
    expect(strip[4]).toHaveAttribute('data-current', 'true')
    expect(screen.getByRole('button', { name: '■ Stop' })).toBeInTheDocument()
    expect(cell('5 E5')).toHaveAttribute('data-highlight', 'target') // E is in C7
  })

  it('switches position, feel, quick change and tempo', () => {
    renderJam()
    fireEvent.change(screen.getByRole('combobox', { name: 'Position' }), { target: { value: '1' } })
    expect(backing.config?.tonicPc).toBe(0)
    expect(screen.getByLabelText('Current chord')).toHaveTextContent('C7')
    fireEvent.click(screen.getByRole('button', { name: 'Straight' }))
    expect(backing.config?.feel).toBe('straight')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Quick change' }))
    expect(backing.config?.form[1]).toBe('IV')
    fireEvent.change(screen.getByRole('slider', { name: /Tempo/ }), { target: { value: '140' } })
    expect(backing.config?.bpm).toBe(140)
  })

  it('keeps the tempo inside 60–160 BPM', () => {
    render(
      <SettingsProvider storage={null}>
        <Jam />
      </SettingsProvider>,
    )
    fireEvent.change(screen.getByRole('slider', { name: /Tempo/ }), { target: { value: '40' } })
    expect(backing.config?.bpm).toBe(60)
  })

  it('has a volume and a mute for every instrument', () => {
    renderJam()
    fireEvent.change(screen.getByRole('slider', { name: 'Bass' }), { target: { value: '0.25' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mute hi-hat' }))
    expect(backing.mix?.bass).toEqual({ volume: 0.25, muted: false })
    expect(backing.mix?.hat).toEqual({ volume: 0.4, muted: true })
    for (const name of ['Kick', 'Snare', 'Hi-hat', 'Chords']) {
      expect(screen.getByRole('slider', { name })).toBeInTheDocument()
    }
  })

  it('shows what I play only when asked, re-rendering only when the note changes', () => {
    renderJam()
    expect(mic.listener).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show what I play' }))
    expect(screen.getByText(/Use headphones/)).toBeInTheDocument()
    const reading = { freq: midiToFreq(67), clarity: 1, rms: 0.1 }
    act(() => mic.listener?.(reading, 0.1))
    expect(cell('-2 G4')).toHaveAttribute('data-highlight', 'detected')
    const before = commits
    act(() => {
      for (let i = 0; i < 30; i++) mic.listener?.(reading, 0.1)
    })
    expect(commits).toBe(before)
  })

  it('keeps the same layout stopped and playing', () => {
    const shape = () => {
      const { container, unmount } = renderJam()
      const areas = layoutShape(container, ['output', '[aria-label="12-bar form"] li', 'fieldset'])
      const children = [...container.children].map((e) => e.tagName)
      unmount()
      return { areas, children }
    }
    const stopped = shape()
    backing.running = true
    backing.bar = 9
    expect(shape()).toEqual(stopped)
  })
})
