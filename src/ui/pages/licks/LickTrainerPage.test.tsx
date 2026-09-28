import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { scriptedRng } from '../../../core/games/random'
import { fakeAudio, finishPlayback, hold } from '../../../test/fakeGameAudio'
import { layoutShape } from '../../../test/layout'
import { SettingsProvider } from '../../settings/SettingsContext'
import { LickGame } from './LickTrainerPage'

vi.mock('../../hooks/useGameAudio', () => import('../../../test/fakeGameAudio'))

// rng 0.25 picks index 2 of the ten blues licks: "Root to fifth", -2 -3 4 -4:3 = G4 B4 C5 D5.
const renderGame = () =>
  render(
    <SettingsProvider storage={null}>
      <LickGame rng={scriptedRng([0.25])} />
    </SettingsProvider>,
  )
const start = async () => {
  fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
  expect(await screen.findByText('Your turn — play it back')).toBeInTheDocument()
}
const slots = () =>
  within(screen.getByRole('list', { name: 'Lick notes' }))
    .getAllByRole('listitem')
    .map((li) => li.dataset.state)
const playLick = () => {
  hold(67, 0, 250)
  hold(71, 300, 550)
  hold(72, 600, 850)
  hold(74, 900, 1150)
}

describe('LickGame', () => {
  beforeEach(() => {
    fakeAudio.reset()
    localStorage.clear()
  })

  it('plays the lick at the tempo, then accepts it played back', async () => {
    renderGame()
    await start()
    expect(fakeAudio.played).toEqual([[67, 71, 72, 74]])
    // 90 BPM: 666.7 ms a beat; the last note is 3 beats
    expect(fakeAudio.timed[0].map((n) => Math.round(n.ms))).toEqual([667, 667, 667, 2000])
    expect(screen.getByText('Root to fifth · 4 notes')).toBeInTheDocument()
    hold(67, 0, 250)
    expect(slots()).toEqual(['done', 'current', 'todo', 'todo'])
    hold(71, 300, 550)
    hold(72, 600, 850)
    hold(74, 900, 1150)
    expect(screen.getByText('✓ Well done!')).toBeInTheDocument()
    expect(screen.getByLabelText('Lick tab')).toHaveTextContent('-2-34-4')
  })

  it('reveals the tab under the slots on request in practice', async () => {
    renderGame()
    await start()
    expect(screen.getByLabelText('Lick tab')).toHaveTextContent('')
    fireEvent.click(screen.getByRole('button', { name: /Show tab/ }))
    expect(screen.getByLabelText('Lick tab')).toHaveTextContent('-2-34-4')
    expect(screen.getByRole('button', { name: '-2 G4' })).toHaveAttribute(
      'data-highlight',
      'target',
    )
  })

  it('names a wrong note and replays the same lick on Try again', async () => {
    renderGame()
    await start()
    hold(67, 0, 250)
    hold(69, 300, 550)
    expect(screen.getByText('✗ Note 2: you played A4, it was B4')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }))
    expect(await screen.findByText('Your turn — play it back')).toBeInTheDocument()
    expect(fakeAudio.played).toEqual([
      [67, 71, 72, 74],
      [67, 71, 72, 74],
    ])
  })

  it('practises the lick chosen in the toolbar', async () => {
    renderGame()
    fireEvent.change(screen.getByRole('combobox', { name: 'Lick' }), { target: { value: 'call' } })
    await start()
    expect(fakeAudio.played).toEqual([[74, 77, 79, 77, 74]])
  })

  it('scores ten random licks with the melody points, and hides the tab', async () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    await start()
    expect(screen.queryByRole('button', { name: /Show tab/ })).toBeNull()
    playLick()
    // 1 + (1 − 1150 / 12000) = 1.904 → 190
    expect(screen.getByRole('status')).toHaveTextContent('Round 2 of 10 · Score 190')
  })

  it.each(['Practice', 'Scored'])(
    'keeps the same stage rows, slot row and tab line in every phase (%s)',
    async (mode) => {
      fakeAudio.deferPlayback = true
      const { container } = renderGame()
      fireEvent.click(screen.getByRole('button', { name: mode }))
      const shape = () =>
        layoutShape(container, ['[aria-label="Lick notes"]', '[aria-label="Lick tab"]'])
      const idle = shape()
      expect(idle.stageRows).toHaveLength(3)
      fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
      expect(screen.getByText('Listen…')).toBeInTheDocument()
      expect(shape()).toEqual(idle)
      await finishPlayback()
      expect(shape()).toEqual(idle)
      hold(67, 0, 250)
      hold(69, 300, 550)
      expect(screen.getByText(/✗ Note 2/)).toBeInTheDocument()
      expect(shape()).toEqual(idle)
    },
  )
})
