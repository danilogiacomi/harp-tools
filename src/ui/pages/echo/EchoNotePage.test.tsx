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

  it('offers "hear again" and "show me" after 3 s of wrong notes in practice', async () => {
    renderGame()
    await start()
    hold(62, 0, 2950)
    expect(screen.queryByRole('button', { name: /Hear again/ })).toBeNull()
    hold(62, 3000, 3000)
    fireEvent.click(screen.getByRole('button', { name: /Show me/ }))
    expect(screen.getByRole('button', { name: '1 C4' })).toHaveAttribute('data-highlight', 'target')
    fireEvent.click(screen.getByRole('button', { name: /Hear again/ }))
    expect(fakeAudio.played).toEqual([[60], [60]])
  })

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
})
