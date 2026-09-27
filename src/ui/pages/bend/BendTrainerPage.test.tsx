import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { scriptedRng } from '../../../core/games/random'
import { fakeAudio, hold } from '../../../test/fakeGameAudio'
import { layoutShape } from '../../../test/layout'
import { SettingsProvider } from '../../settings/SettingsContext'
import { BendGame } from './BendTrainerPage'

vi.mock('../../hooks/useGameAudio', () => import('../../../test/fakeGameAudio'))

const renderGame = () =>
  render(
    <SettingsProvider storage={null}>
      <BendGame rng={scriptedRng([0.5])} />
    </SettingsProvider>,
  )

/** Hole 3 only: -3' (A#4), -3'' (A4), -3''' (G#4); rng 0.5 picks the middle one. */
const onlyHole3 = () => {
  fireEvent.change(screen.getByRole('combobox', { name: /From hole/ }), { target: { value: '3' } })
  fireEvent.change(screen.getByRole('combobox', { name: /To hole/ }), { target: { value: '3' } })
}

describe('BendGame', () => {
  beforeEach(() => {
    fakeAudio.reset()
    localStorage.clear()
  })

  it('shows the target on the chart and the meter, and accepts a held bend', () => {
    renderGame()
    onlyHole3()
    fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
    expect(screen.getByText("Bend to -3'' (A4)")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "-3'' A4" })).toHaveAttribute(
      'data-highlight',
      'target',
    )
    expect(screen.getAllByTestId('bend-marker')).toHaveLength(4)

    hold(69, 0, 450)
    expect(screen.getByTestId('bend-dot').style.top).toBe('62.5%') // two steps below -3
    hold(69, 500, 500)
    expect(screen.getByText(/Got it — stability 100%/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "-3'' A4" })).toHaveAttribute(
      'data-highlight',
      'correct',
    )
  })

  it('lets practice pick a specific bend', () => {
    renderGame()
    fireEvent.change(screen.getByRole('combobox', { name: 'Target' }), {
      target: { value: '3:drawBend:3' },
    })
    fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
    expect(screen.getByText("Bend to -3''' (G#4)")).toBeInTheDocument()
  })

  it('plays the target on request', () => {
    renderGame()
    onlyHole3()
    fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
    fireEvent.click(screen.getByRole('button', { name: /Hear target/ }))
    expect(fakeAudio.played).toEqual([[69]])
  })

  it('scores stability and speed in scored mode', () => {
    renderGame()
    onlyHole3()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
    hold(69, 0, 500)
    // accuracy 0.5 + 0.5 × 1 = 1; bonus 1 + (1 − 500 / 10000) = 1.95 → 195
    expect(screen.getByText(/\+195/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Round 2 of 10 · Score 195')
  })

  it('explains when the chosen holes have no bends', () => {
    renderGame()
    fireEvent.change(screen.getByRole('combobox', { name: /From hole/ }), {
      target: { value: '5' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: /To hole/ }), { target: { value: '5' } })
    expect(screen.getByRole('alert')).toHaveTextContent('These holes have no bends')
    expect(screen.queryByRole('button', { name: '▶ Start' })).toBeNull()
  })

  it.each(['Practice', 'Scored'])(
    'keeps the same stage rows and bend meter in every phase (%s)',
    (mode) => {
      const { container } = renderGame()
      onlyHole3()
      fireEvent.click(screen.getByRole('button', { name: mode }))
      const shape = () => layoutShape(container, ['[aria-label="Bend meter"]'])
      const idle = shape()
      expect(idle.stageRows).toHaveLength(3)
      expect(idle.areas['[aria-label="Bend meter"]']).toBe(1)
      fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
      expect(screen.getByText("Bend to -3'' (A4)")).toBeInTheDocument()
      expect(shape()).toEqual(idle)
      hold(69, 0, 500)
      expect(screen.getByText(/Got it/)).toBeInTheDocument()
      expect(shape()).toEqual(idle)
    },
  )

  it('keeps the mic on when a setting change restarts the run', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    fireEvent.click(screen.getByRole('button', { name: 'Practice' }))
    expect(fakeAudio.micStarts).toBe(1)
  })

  it('waits for the microphone before offering Start', () => {
    fakeAudio.micStatus = 'starting'
    renderGame()
    expect(screen.getByText('Waiting for microphone…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '▶ Start' })).toBeNull()
  })

  it('silences the target when stopped', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
    fireEvent.click(screen.getByRole('button', { name: /Hear target/ }))
    fireEvent.click(screen.getByRole('button', { name: '■ Stop' }))
    expect(fakeAudio.cancels).toBe(1)
  })
})
