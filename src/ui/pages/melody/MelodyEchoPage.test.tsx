import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { scriptedRng } from '../../../core/games/random'
import { fakeAudio, hold } from '../../../test/fakeGameAudio'
import { SettingsProvider } from '../../settings/SettingsContext'
import { MelodyGame } from './MelodyEchoPage'

vi.mock('../../hooks/useGameAudio', () => import('../../../test/fakeGameAudio'))

// Holes 1–2 on a C harp: pool [60, 62, 64, 67]. rng [0.5, 0.4, 0.9]:
// start at index 2 (64); from 2, 0.4 × 10 = 4 → index 1 (62); from 1, 0.9 × 10 = 9 → index 3 (67).
const renderGame = () => {
  render(
    <SettingsProvider storage={null}>
      <MelodyGame rng={scriptedRng([0.5, 0.4, 0.9])} />
    </SettingsProvider>,
  )
  fireEvent.change(screen.getByRole('combobox', { name: /To hole/ }), { target: { value: '2' } })
}
const start = async () => {
  fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
  expect(await screen.findByText('Your turn — play it back')).toBeInTheDocument()
}
const slots = () =>
  within(screen.getByRole('list', { name: 'Phrase' }))
    .getAllByRole('listitem')
    .map((li) => li.dataset.state)

describe('MelodyGame', () => {
  beforeEach(() => {
    fakeAudio.reset()
    localStorage.clear()
  })

  it('plays a phrase and accepts it played back in order', async () => {
    renderGame()
    await start()
    expect(fakeAudio.played).toEqual([[64, 62, 67]])
    hold(64, 0, 250)
    expect(slots()).toEqual(['done', 'current', 'todo'])
    hold(62, 300, 550)
    hold(67, 600, 850)
    expect(screen.getByText('✓ Well done!')).toBeInTheDocument()
    expect(slots()).toEqual(['done', 'done', 'done'])
  })

  it('shows which note was wrong and lets the player retry', async () => {
    renderGame()
    await start()
    hold(64, 0, 250)
    hold(65, 300, 550)
    expect(screen.getByText('✗ Note 2: you played F4, it was D4')).toBeInTheDocument()
    expect(slots()).toEqual(['done', 'wrong', 'todo'])
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }))
    expect(await screen.findByText('Your turn — play it back')).toBeInTheDocument()
    expect(fakeAudio.played).toEqual([
      [64, 62, 67],
      [64, 62, 67],
    ])
  })

  it('starts scored phrases at two notes and grows them after a success', async () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    expect(screen.getByText('Phrase length: 2')).toBeInTheDocument()
    await start()
    expect(fakeAudio.played).toEqual([[64, 62]])
    hold(64, 0, 250)
    hold(62, 300, 550)
    // 1 + (1 − 550 / 6000) = 1.9083 → 191
    expect(screen.getByRole('status')).toHaveTextContent('Round 2 of 10 · Score 191')
    expect(screen.getByText('Phrase length: 3')).toBeInTheDocument()
  })

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
})
