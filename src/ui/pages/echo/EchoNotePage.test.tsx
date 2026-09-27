import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { scriptedRng } from '../../../core/games/random'
import { fakeAudio, hold } from '../../../test/fakeGameAudio'
import { SettingsProvider } from '../../settings/SettingsContext'
import { EchoGame } from './EchoNotePage'

vi.mock('../../hooks/useGameAudio', () => import('../../../test/fakeGameAudio'))

// rng 0 → the lowest pool note: C4 (hole 1 blow) on the default C harp.
const renderGame = () =>
  render(
    <SettingsProvider storage={null}>
      <EchoGame rng={scriptedRng([0])} />
    </SettingsProvider>,
  )

const start = async () => {
  fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
  expect(await screen.findByText('Play it back and hold it')).toBeInTheDocument()
}

describe('EchoGame', () => {
  beforeEach(() => {
    fakeAudio.reset()
    localStorage.clear()
  })

  it('plays a note and accepts it once held', async () => {
    renderGame()
    await start()
    expect(fakeAudio.played).toEqual([[60]])
    hold(60, 0, 450)
    expect(screen.getByRole('progressbar', { name: 'Hold' })).toHaveAttribute('aria-valuenow', '90')
    hold(60, 500, 500)
    expect(screen.getByText(/Correct — C4/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1 C4' })).toHaveAttribute(
      'data-highlight',
      'correct',
    )
  })

  it('can replay the note at any time while listening', async () => {
    renderGame()
    await start()
    fireEvent.click(screen.getByRole('button', { name: /Hear again/ }))
    expect(fakeAudio.played).toEqual([[60], [60]])
  })

  it('reveals how to play the note in practice mode', async () => {
    renderGame()
    await start()
    expect(screen.queryByText(/Hole 1/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Show me/ }))
    expect(screen.getByText('C4: Hole 1 · blow (1)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1 C4' })).toHaveAttribute('data-highlight', 'target')
    expect(screen.queryByRole('button', { name: /Show me/ })).toBeNull()
  })

  it('names every hole that plays the note', async () => {
    render(
      <SettingsProvider storage={null}>
        {/* rng 0.2 → G4 in the 19-note C-harp pool, playable as -2 or 3 */}
        <EchoGame rng={scriptedRng([0.2])} />
      </SettingsProvider>,
    )
    await start()
    fireEvent.click(screen.getByRole('button', { name: /Show me/ }))
    expect(screen.getByText(/Hole 2 · draw \(-2\) or Hole 3 · blow \(3\)/)).toBeInTheDocument()
  })

  it('offers "hear again" but not "show me" in scored mode', async () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    await start()
    expect(screen.getByRole('button', { name: /Hear again/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Show me/ })).toBeNull()
  })

  it.each(['Practice', 'Scored'])(
    'keeps the same stage rows in every phase (%s), so the layout does not jump',
    async (mode) => {
      const { container } = renderGame()
      fireEvent.click(screen.getByRole('button', { name: mode }))
      const rows = () => container.querySelector('.status')!.children.length
      expect(rows()).toBe(3)
      await start()
      expect(rows()).toBe(3)
      hold(60, 0, 500)
      expect(screen.getByText(/Correct — C4/)).toBeInTheDocument()
      expect(rows()).toBe(3)
    },
  )

  it('scores a quick hit in scored mode', async () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    await start()
    hold(60, 0, 500)
    // 1 + (1 − 500 / 8000) = 1.9375 → 194
    expect(screen.getByText(/\+194/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Round 2 of 10 · Score 194')
  })

  it('times out after 8 s in scored mode and counts the miss', async () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    await start()
    expect(screen.queryByRole('button', { name: '1 C4' })).not.toHaveAttribute('data-highlight')
    hold(null, 0, 7950)
    expect(screen.getByText('1 s left')).toBeInTheDocument()
    hold(null, 8000, 8000)
    expect(screen.getByText(/Time's up — it was C4/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Round 2 of 10 · Score 0')
  })

  it('abandons the round when the mode changes', async () => {
    renderGame()
    await start()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    expect(screen.getByRole('button', { name: '▶ Start' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Round 1 of 10 · Score 0')
    hold(60, 0, 500)
    expect(screen.queryByText(/Correct/)).toBeNull()
  })

  it('says so when the filters leave no notes', () => {
    renderGame()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Blow / draw' }))
    expect(screen.getByRole('alert')).toHaveTextContent('No notes match these filters')
    expect(screen.queryByRole('button', { name: '▶ Start' })).toBeNull()
  })

  it('shows the microphone problem instead of a Start button', () => {
    fakeAudio.error = 'denied'
    renderGame()
    expect(screen.getByRole('alert')).toHaveTextContent('Microphone unavailable')
    expect(screen.queryByRole('button', { name: '▶ Start' })).toBeNull()
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

  it('cancels the prompt when a setting change restarts the run', () => {
    fakeAudio.deferPlayback = true
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    expect(fakeAudio.cancels).toBe(1)
  })
})
