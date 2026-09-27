import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scriptedRng } from '../../../core/games/random'
import { fakeAudio, hold } from '../../../test/fakeGameAudio'
import { layoutShape } from '../../../test/layout'
import { SettingsProvider } from '../../settings/SettingsContext'
import { HoleFinderGame } from './HoleFinderPage'

vi.mock('../../hooks/useGameAudio', () => import('../../../test/fakeGameAudio'))

// rng 0 → the lowest pool note: C4 (hole 1 blow). rng 0.2 → G4 (index 3 of the 19-note pool).
const renderGame = (rng: number[] = [0]) =>
  render(
    <SettingsProvider storage={null}>
      <HoleFinderGame rng={scriptedRng(rng)} />
    </SettingsProvider>,
  )
const start = () => fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
const target = () => screen.getByTestId('target-note').textContent
const box = (name: string) => screen.getByRole('button', { name })

describe('HoleFinderGame', () => {
  beforeEach(() => {
    fakeAudio.reset()
    localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a note name and plays nothing', () => {
    renderGame()
    start()
    expect(target()).toBe('C4')
    expect(fakeAudio.played).toEqual([])
    expect(box('1 blow')).not.toHaveAttribute('data-highlight')
  })

  it('accepts the note played on any hole that has it', () => {
    renderGame([0.2])
    start()
    expect(target()).toBe('G4')
    hold(67, 0, 500)
    expect(screen.getByText('✓ G4 (-2 or 3)')).toBeInTheDocument()
    expect(box('-2 draw')).toHaveAttribute('data-highlight', 'correct')
    expect(box('3 blow')).toHaveAttribute('data-highlight', 'correct')
  })

  it('reveals where the note is in practice', () => {
    renderGame()
    start()
    expect(screen.queryByText(/Hole 1/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Show me/ }))
    expect(screen.getByText('C4: Hole 1 · blow (1)')).toBeInTheDocument()
    expect(box('1 blow')).toHaveAttribute('data-highlight', 'target')
    expect(screen.queryByRole('button', { name: /Show me/ })).toBeNull()
  })

  it('never lets a chart button announce its own note name', () => {
    renderGame()
    start()
    expect(target()).toBe('C4')
    const chart = within(screen.getByRole('group', { name: 'Harmonica chart' }))
    for (const button of chart.getAllByRole('button')) {
      expect(button.getAttribute('aria-label')).not.toContain('C4')
    }
  })

  it('skips to a different note', () => {
    renderGame()
    start()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(target()).toBe('D4')
  })

  it('moves on 1.5 s after a hit, never to the same note', () => {
    vi.useFakeTimers()
    renderGame()
    start()
    hold(60, 0, 500)
    expect(screen.getByText('✓ C4 (1)')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1500))
    expect(target()).toBe('D4')
  })

  it('offers no help in scored mode and scores a quick hit', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    start()
    expect(screen.queryByRole('button', { name: /Show me/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull()
    hold(60, 0, 500)
    // 1 + (1 − 500 / 8000) = 1.9375 → 194
    expect(screen.getByText(/\+194/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Round 2 of 10 · Score 194')
  })

  it('times out after 8 s in scored mode and shows where the note was', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    start()
    hold(null, 0, 7950)
    expect(screen.getByText('1 s left')).toBeInTheDocument()
    hold(null, 8000, 8000)
    expect(screen.getByText("✗ Time's up — it was C4 (1)")).toBeInTheDocument()
    expect(screen.getByText('C4: Hole 1 · blow (1)')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Round 2 of 10 · Score 0')
  })

  it.each(['Practice', 'Scored'])(
    'keeps the same layout in every phase (%s), so nothing jumps',
    (mode) => {
      const { container } = renderGame()
      fireEvent.click(screen.getByRole('button', { name: mode }))
      const shape = layoutShape(container, ['[aria-label="Harmonica chart"]'])
      expect(shape.stageRows).toEqual(['P', 'DIV', 'P'])
      start()
      expect(layoutShape(container, ['[aria-label="Harmonica chart"]'])).toEqual(shape)
      hold(60, 0, 500)
      expect(screen.getByText(/✓ C4/)).toBeInTheDocument()
      expect(layoutShape(container, ['[aria-label="Harmonica chart"]'])).toEqual(shape)
    },
  )

  it('says so when the filters leave no notes', () => {
    renderGame()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Blow / draw' }))
    expect(screen.getByRole('alert')).toHaveTextContent('No notes match these filters')
    expect(screen.queryByRole('button', { name: '▶ Start' })).toBeNull()
  })

  it('waits for the microphone before offering Start', () => {
    fakeAudio.micStatus = 'starting'
    renderGame()
    expect(screen.getByText('Waiting for microphone…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '▶ Start' })).toBeNull()
  })
})
