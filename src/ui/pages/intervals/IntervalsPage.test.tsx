import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { scriptedRng } from '../../../core/games/random'
import { fakeAudio, finishPlayback, hold } from '../../../test/fakeGameAudio'
import { SettingsProvider } from '../../settings/SettingsContext'
import { IntervalGame } from './IntervalsPage'

vi.mock('../../hooks/useGameAudio', () => import('../../../test/fakeGameAudio'))

// rng [0, 0]: the first interval with a pair in the C-harp pool (minor 2nd), then its lowest
// pair: B4 (71) → C5 (72).
const renderGame = () =>
  render(
    <SettingsProvider storage={null}>
      <IntervalGame rng={scriptedRng([0, 0])} />
    </SettingsProvider>,
  )
const start = () => fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))

describe('IntervalGame', () => {
  beforeEach(() => {
    fakeAudio.reset()
    localStorage.clear()
  })

  it('plays two notes and accepts the right name', async () => {
    renderGame()
    start()
    expect(await screen.findByText('Which interval?')).toBeInTheDocument()
    expect(fakeAudio.played).toEqual([[71, 72]])
    expect(
      screen.getAllByRole('button', { name: /^(Minor|Major|Perfect|Tritone|Octave)/ }),
    ).toHaveLength(12)
    fireEvent.click(screen.getByRole('button', { name: 'Minor 2nd' }))
    expect(screen.getByText('✓ Minor 2nd')).toBeInTheDocument()
  })

  it('shows the right answer after a wrong one', async () => {
    renderGame()
    start()
    await screen.findByText('Which interval?')
    fireEvent.click(screen.getByRole('button', { name: 'Major 2nd' }))
    expect(screen.getByText('✗ It was: Minor 2nd')).toBeInTheDocument()
  })

  it('scores name answers by speed in scored mode', async () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    start()
    await screen.findByText('Which interval?')
    fakeAudio.time = 5000
    fireEvent.click(screen.getByRole('button', { name: 'Minor 2nd' }))
    expect(screen.getByRole('status')).toHaveTextContent('Round 2 of 10 · Score 150')
  })

  it('in play mode, plays the low note and listens for the high one', async () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Play it' }))
    start()
    expect(await screen.findByText('Play a minor 2nd above B4')).toBeInTheDocument()
    expect(fakeAudio.played).toEqual([[71]])
    hold(72, 0, 500)
    expect(screen.getByText('✓ C5 — Minor 2nd')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '4 C5' })).toHaveAttribute(
      'data-highlight',
      'correct',
    )
  })

  it('in play mode, names the interval to play while the low note sounds', async () => {
    fakeAudio.deferPlayback = true
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Play it' }))
    start()
    expect(screen.getByText('Listen… then play a minor 2nd above B4')).toBeInTheDocument()
    await finishPlayback()
    expect(screen.getByText('Play a minor 2nd above B4')).toBeInTheDocument()
  })

  it('does not hang when Replay is pressed while the prompt plays', async () => {
    fakeAudio.deferPlayback = true
    renderGame()
    start()
    expect(screen.getByText('Listen…')).toBeInTheDocument()
    const replay = screen.queryByRole('button', { name: /Replay/ })
    if (replay) fireEvent.click(replay)
    await finishPlayback()
    expect(screen.getByText('Which interval?')).toBeInTheDocument()
  })

  it('stops cleanly while the prompt plays, and starts again', async () => {
    fakeAudio.deferPlayback = true
    renderGame()
    start()
    fireEvent.click(screen.getByRole('button', { name: '■ Stop' }))
    await finishPlayback()
    expect(screen.queryByText('Which interval?')).toBeNull()
    start()
    await finishPlayback()
    expect(screen.getByText('Which interval?')).toBeInTheDocument()
    expect(fakeAudio.played).toHaveLength(2)
  })

  it('offers only the enabled intervals', async () => {
    renderGame()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tritone' }))
    start()
    await screen.findByText('Which interval?')
    expect(screen.queryByRole('button', { name: 'Tritone' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Octave' })).toBeInTheDocument()
  })

  it('explains when no enabled interval fits the notes', () => {
    renderGame()
    fireEvent.change(screen.getByRole('combobox', { name: /To hole/ }), { target: { value: '1' } })
    // Hole 1 only: C4 and D4, so only a major 2nd fits.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Major 2nd' }))
    expect(screen.getByRole('alert')).toHaveTextContent('No enabled interval fits these notes')
    expect(screen.queryByRole('button', { name: '▶ Start' })).toBeNull()
  })
})
