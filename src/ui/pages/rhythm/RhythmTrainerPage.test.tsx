import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeAudio, hold } from '../../../test/fakeGameAudio'
import { layoutShape } from '../../../test/layout'
import { loadBest } from '../../scores/bestScores'
import { SettingsProvider } from '../../settings/SettingsContext'
import { RhythmGame } from './RhythmTrainerPage'

vi.mock('../../hooks/useGameAudio', () => import('../../../test/fakeGameAudio'))
// The metronome's first beat was heard at 1000 ms: at 120 BPM the count-in bar is 1000–2999
// and the first hit is due at 3000.
const metronome = vi.hoisted(() => ({
  running: false,
  beat: null as number | null,
  lastBeatMs: 1000 as number | null,
  toggle: () => {
    metronome.running = !metronome.running
  },
}))
vi.mock('../../hooks/useMetronome', () => ({ useMetronome: () => metronome }))

const renderGame = () => {
  const result = render(
    <SettingsProvider storage={null}>
      <RhythmGame />
    </SettingsProvider>,
  )
  fireEvent.change(screen.getByRole('slider', { name: /Tempo/ }), { target: { value: '120' } })
  return result
}
/** A 100 ms note heard from `onsetMs + 60` (the detection latency), then silence for 200 ms. */
const play = (onsetMs: number) => {
  hold(67, onsetMs + 60, onsetMs + 160)
  hold(null, onsetMs + 210, onsetMs + 410)
}
const hits = () =>
  within(screen.getByRole('list', { name: 'Last hits' }))
    .getAllByRole('listitem')
    .map((li) => li.textContent)

describe('RhythmGame', () => {
  beforeEach(() => {
    fakeAudio.reset()
    localStorage.clear()
    metronome.running = false
  })

  it('starts the metronome, counts in, then grades each hit', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
    expect(metronome.running).toBe(true)
    expect(screen.getByText('Count-in: listen to one bar, then play')).toBeInTheDocument()
    play(3020)
    expect(screen.getByText('Perfect')).toBeInTheDocument()
    play(3430)
    expect(screen.getByText('Good · 70 ms early')).toBeInTheDocument()
    expect(hits().slice(0, 3)).toEqual(['+20 ms', '-70 ms', '·'])
    expect(screen.getByText("You're 25 ms early on average")).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '■ Stop' }))
    expect(metronome.running).toBe(false)
  })

  it('marks a hit that never came as a miss', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
    hold(null, 2000, 3400)
    expect(screen.getByText('Miss')).toBeInTheDocument()
    expect(hits()[0]).toBe('✗')
  })

  it('scores one count-in bar and eight bars, and saves the best per pattern and tempo', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Pattern' }), {
      target: { value: 'charleston' },
    })
    fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
    expect(screen.getByRole('status')).toHaveTextContent('Round 1 of 16')
    // Charleston: hits on beats 0 and 1.5 of each bar → 3000, 3750, 5000, 5750, …
    for (let bar = 0; bar < 8; bar++) {
      play(3000 + bar * 2000)
      play(3750 + bar * 2000 + 50)
    }
    hold(null, 19000, 19500)
    // 8 perfect (100) + 8 off by 50 ms (good, 70) = 1360
    expect(screen.getByRole('status')).toHaveTextContent('Final score: 1360 / 1600')
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument()
    expect(metronome.running).toBe(false)
    expect(loadBest(localStorage, 'rhythm|bpm=120|pattern=charleston')).toBe(1360)
  })

  it('shows the pattern with its accents', () => {
    renderGame()
    fireEvent.change(screen.getByRole('combobox', { name: 'Pattern' }), {
      target: { value: 'train' },
    })
    const dots = within(screen.getByRole('list', { name: 'Pattern' })).getAllByRole('listitem')
    expect(dots).toHaveLength(8)
    expect(dots.map((d) => d.hasAttribute('data-accent'))).toEqual([
      true,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
    ])
  })

  it.each(['Practice', 'Scored'])('keeps the same layout in every phase (%s)', (mode) => {
    const { container } = renderGame()
    fireEvent.click(screen.getByRole('button', { name: mode }))
    const shape = () =>
      layoutShape(container, ['[aria-label="Pattern"] li', '[aria-label="Last hits"] li'])
    const idle = shape()
    expect(idle.stageRows).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
    expect(shape()).toEqual(idle)
    play(3020)
    expect(shape()).toEqual(idle)
    hold(null, 3500, 4000)
    expect(shape()).toEqual(idle)
  })

  it('waits for the microphone before offering Start', () => {
    fakeAudio.micStatus = 'starting'
    renderGame()
    expect(screen.getByText('Waiting for microphone…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '▶ Start' })).toBeNull()
  })
})
