import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeAudio, hold } from '../../../test/fakeGameAudio'
import { layoutShape } from '../../../test/layout'
import { SettingsProvider } from '../../settings/SettingsContext'
import { ScaleGame } from './ScaleRunnerPage'

vi.mock('../../hooks/useGameAudio', () => import('../../../test/fakeGameAudio'))
// Fixed lastBeatMs so the on-beat scoring test below can hand-derive every note's offset
// from a known beat grid, without needing the real audio-clock-driven Metronome.
vi.mock('../../hooks/useMetronome', () => ({
  useMetronome: () => ({ running: false, beat: null, lastBeatMs: 0, toggle: () => {} }),
}))

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

  it('starts a fresh session when a stopped scored run is started again', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
    const midis = [72, 74, 76, 77, 79, 81, 83, 84]
    midis.slice(0, 5).forEach((midi, k) => hold(midi, k * 1000, k * 1000 + 500))
    fireEvent.click(screen.getByRole('button', { name: '■ Stop' }))
    fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
    expect(screen.getByRole('status')).toHaveTextContent('Round 1 of 8')
    midis.slice(0, 3).forEach((midi, k) => hold(midi, 10000 + k * 1000, 10000 + k * 1000 + 500))
    expect(screen.getByRole('status')).toHaveTextContent('Round 4 of 8')
    expect(screen.getByText('Next: -5 (F5)')).toBeInTheDocument()
    expect(localStorage.length).toBe(0)
  })

  it('rewards notes landed on the beat when playing with the metronome', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Play with metronome/ }))
    fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
    const midis = [72, 74, 76, 77, 79, 81, 83, 84]
    // bpm 90 (default settings) → beat period 2000/3 ms, mocked lastBeatMs fixed at 0.
    // onset(k) = k × 1000 ms; after the 60 ms latency compensation the offset from the
    // nearest beat is exactly 60 ms (within the ±100 ms window → 200 pts) on even k, and
    // exactly 2000/3 − 60 ≈ 273.33 ms (outside it → 100 pts) on odd k — the pattern repeats
    // every 2 notes because 3000 mod 2000 = 1000 ≠ 0 but 6000 mod 2000 = 0.
    // 4 × 200 + 4 × 100 = 1200, distinct from the no-metronome (speed-bonus-only) 1352 above,
    // so this fails if withMetronome doesn't reach onHeard or the beat is ignored.
    midis.forEach((midi, k) => hold(midi, k * 1000, k * 1000 + 500))
    expect(screen.getByRole('status')).toHaveTextContent('Final score: 1200 / 1600')
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

  it.each(['Practice', 'Scored'])('keeps the same stage rows in every phase (%s)', (mode) => {
    const { container } = renderGame()
    fireEvent.click(screen.getByRole('button', { name: mode }))
    const idle = layoutShape(container)
    expect(idle.stageRows).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
    expect(screen.getByText('Next: 4 (C5)')).toBeInTheDocument()
    expect(layoutShape(container)).toEqual(idle)
    ;[72, 74, 76, 77, 79, 81, 83, 84].forEach((midi, k) => hold(midi, k * 1000, k * 1000 + 500))
    expect(screen.queryByText(/^Next:/)).toBeNull()
    expect(layoutShape(container)).toEqual(idle)
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
