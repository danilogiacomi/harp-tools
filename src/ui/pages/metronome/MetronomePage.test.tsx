import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SettingsProvider } from '../../settings/SettingsContext'
import { MetronomePanel } from './MetronomePage'

const toggle = vi.hoisted(() => vi.fn())
const metronome = vi.hoisted(() => ({ running: false, beat: null as number | null }))
vi.mock('../../hooks/useMetronome', () => ({
  useMetronome: () => ({ ...metronome, toggle }),
}))

const renderPanel = () =>
  render(
    <SettingsProvider storage={null}>
      <MetronomePanel />
    </SettingsProvider>,
  )

describe('MetronomePanel', () => {
  it('adjusts the tempo within 30–250 BPM', () => {
    renderPanel()
    expect(screen.getByLabelText('BPM')).toHaveTextContent('90')
    fireEvent.click(screen.getByRole('button', { name: 'Faster' }))
    expect(screen.getByLabelText('BPM')).toHaveTextContent('91')
    fireEvent.change(screen.getByRole('slider', { name: 'Tempo' }), { target: { value: '250' } })
    fireEvent.click(screen.getByRole('button', { name: 'Faster' }))
    expect(screen.getByLabelText('BPM')).toHaveTextContent('250')
  })

  it('shows one beat dot per pulse of the time signature', () => {
    renderPanel()
    expect(screen.getAllByTestId('beat-dot')).toHaveLength(4)
    fireEvent.change(screen.getByLabelText('Time signature'), { target: { value: '6/8' } })
    const dots = screen.getAllByTestId('beat-dot')
    expect(dots).toHaveLength(6)
    expect(dots.map((d) => d.dataset.accent)).toEqual([
      'bar',
      'beat',
      'beat',
      'group',
      'beat',
      'beat',
    ])
  })

  it('toggles on Space but ignores auto-repeat from a held key', () => {
    toggle.mockClear()
    renderPanel()
    fireEvent.keyDown(window, { code: 'Space', key: ' ' })
    expect(toggle).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { code: 'Space', key: ' ', repeat: true })
    fireEvent.keyDown(window, { code: 'Space', key: ' ', repeat: true })
    expect(toggle).toHaveBeenCalledTimes(1)
  })
  it('keeps the same layout stopped and running, so nothing moves on Start or Stop', () => {
    metronome.running = false
    metronome.beat = null
    const { container, rerender } = renderPanel()
    const shape = () =>
      [...container.querySelectorAll('*')].map((el) => `${el.tagName}.${el.className}`)
    const stopped = shape()
    metronome.running = true
    metronome.beat = 2
    rerender(
      <SettingsProvider storage={null}>
        <MetronomePanel />
      </SettingsProvider>,
    )
    expect(screen.getByRole('button', { name: '■ Stop' })).toBeInTheDocument()
    expect(shape()).toEqual(stopped)
    metronome.running = false
    metronome.beat = null
  })
})
