import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeAudio, hold } from '../../../test/fakeGameAudio'
import { SettingsProvider } from '../../settings/SettingsContext'
import { ScaleGame } from './ScaleRunnerPage'

vi.mock('../../hooks/useGameAudio', () => import('../../../test/fakeGameAudio'))

const renderGame = () =>
  render(
    <SettingsProvider storage={null}>
      <ScaleGame />
    </SettingsProvider>,
  )
const select = (name: string, value: string) =>
  fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } })
const cell = (name: string) => screen.getByRole('button', { name })
const octaveOptions = () =>
  within(screen.getByRole('combobox', { name: 'Octave' }))
    .getAllByRole('option')
    .map((o) => o.textContent)

describe('ScaleGame', () => {
  beforeEach(() => {
    fakeAudio.reset()
    localStorage.clear()
  })

  it('offers every playable octave and defaults to the easiest', () => {
    renderGame()
    expect(octaveOptions()).toEqual(['1 → 4', '4 → 7', '7 → 10'])
    expect(screen.getByRole('combobox', { name: 'Octave' })).toHaveValue('1')
  })

  it('walks the path, highlighting the next hole', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
    expect(cell('4 C5')).toHaveAttribute('data-highlight', 'target')
    expect(screen.getByText('Next: 4 (C5)')).toBeInTheDocument()
    hold(72, 0, 500)
    expect(cell('4 C5')).toHaveAttribute('data-highlight', 'correct')
    expect(cell('-4 D5')).toHaveAttribute('data-highlight', 'target')
  })

  it('uses bends for 2nd position blues and adds octaves with over-notes', () => {
    renderGame()
    select('Scale', 'blues')
    select('Position', '2')
    expect(octaveOptions()).toEqual(['-2 → 6'])
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include overblows/overdraws' }))
    expect(octaveOptions()).toEqual(['-2 → 6', '6 → 9'])
    select('Octave', '0')
    fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
    expect(cell('-2 G4')).toHaveAttribute('data-highlight', 'target')
    hold(67, 0, 500)
    expect(cell("-3' A#4")).toHaveAttribute('data-highlight', 'target')
  })

  it('scores one run, one round per note', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
    expect(screen.getByRole('status')).toHaveTextContent('Round 1 of 8')
    const midis = [72, 74, 76, 77, 79, 81, 83, 84]
    midis.forEach((midi, k) => hold(midi, k * 1000, k * 1000 + 500))
    // first note 500 ms → 183; the rest 1000 ms apart → 167 each: 183 + 7 × 167 = 1352
    expect(screen.getByRole('status')).toHaveTextContent('Final score: 1352 / 1600')
    expect(screen.getByRole('status')).toHaveTextContent('8 of 8 correct')
  })

  it('finishes a practice run and offers another', () => {
    renderGame()
    select('Direction', 'down')
    fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
    expect(cell('7 C6')).toHaveAttribute('data-highlight', 'target')
    ;[84, 83, 81, 79, 77, 76, 74, 72].forEach((midi, k) => hold(midi, k * 1000, k * 1000 + 500))
    expect(screen.getByText('✓ Run complete!')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '▶ Again' })).toBeInTheDocument()
  })
})
