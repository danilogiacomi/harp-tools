import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { scriptedRng } from '../../../core/games/random'
import { fakeAudio, finishPlayback, hold } from '../../../test/fakeGameAudio'
import { layoutShape } from '../../../test/layout'
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

  it.each(['Practice', 'Scored'])(
    'keeps the same stage rows and answer grid in every phase (%s, name it)',
    async (mode) => {
      fakeAudio.deferPlayback = true
      const { container } = renderGame()
      fireEvent.click(screen.getByRole('button', { name: mode }))
      const shape = () => layoutShape(container, ['[aria-label="Answers"] button'])
      const idle = shape()
      expect(idle.stageRows).toHaveLength(3)
      expect(idle.areas['[aria-label="Answers"] button']).toBe(12)
      start()
      expect(screen.getByText('Listen…')).toBeInTheDocument()
      expect(shape()).toEqual(idle)
      await finishPlayback()
      expect(screen.getByText('Which interval?')).toBeInTheDocument()
      expect(shape()).toEqual(idle)
      fireEvent.click(screen.getByRole('button', { name: 'Minor 2nd' }))
      expect(screen.getByText(/✓ Minor 2nd/)).toBeInTheDocument()
      expect(shape()).toEqual(idle)
    },
  )

  it('only lets the answer buttons be pressed while answering', async () => {
    fakeAudio.deferPlayback = true
    renderGame()
    expect(screen.getByRole('button', { name: 'Minor 2nd' })).toBeDisabled()
    start()
    expect(screen.getByRole('button', { name: 'Minor 2nd' })).toBeDisabled()
    await finishPlayback()
    fireEvent.click(screen.getByRole('button', { name: 'Minor 2nd' }))
    expect(screen.getByRole('button', { name: 'Minor 2nd' })).toBeDisabled()
  })

  it('keeps the same stage rows in every phase (play it)', async () => {
    fakeAudio.deferPlayback = true
    const { container } = renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Play it' }))
    const idle = layoutShape(container)
    expect(idle.stageRows).toHaveLength(3)
    start()
    expect(layoutShape(container)).toEqual(idle)
    await finishPlayback()
    expect(screen.getByText('Play a minor 2nd above B4')).toBeInTheDocument()
    expect(layoutShape(container)).toEqual(idle)
    hold(72, 0, 500)
    expect(screen.getByText(/✓ C5/)).toBeInTheDocument()
    expect(layoutShape(container)).toEqual(idle)
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

  it('uses the mic only in play mode, and keeps it on across setting changes', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    expect(fakeAudio.micStarts).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Play it' }))
    fireEvent.click(screen.getByRole('button', { name: 'Practice' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tritone' }))
    expect(fakeAudio.micStarts).toBe(1)
  })

  it('waits for the microphone only in play mode', () => {
    fakeAudio.micStatus = 'starting'
    renderGame()
    expect(screen.getByRole('button', { name: '▶ Start' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Play it' }))
    expect(screen.getByText('Waiting for microphone…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '▶ Start' })).toBeNull()
  })
})
