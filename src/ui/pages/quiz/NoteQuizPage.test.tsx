import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scriptedRng } from '../../../core/games/random'
import { layoutShape } from '../../../test/layout'
import { loadBest } from '../../scores/bestScores'
import { SettingsProvider } from '../../settings/SettingsContext'
import { QuizGame } from './NoteQuizPage'

let clock = 0

// rng 0 → the first pool box: hole 1 blow (C4 on a C harp). rng 0.2 → G4 in "Find the hole".
const renderGame = (rng: number[] = [0], storage: Storage | null = null) =>
  render(
    <SettingsProvider storage={storage}>
      <QuizGame rng={scriptedRng(rng)} now={() => clock} />
    </SettingsProvider>,
  )
const start = () => fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
const answers = () => within(screen.getByRole('group', { name: 'Answers' })).getAllByRole('button')
const box = (name: string) => screen.getByRole('button', { name })
const findTask = () => fireEvent.click(screen.getByRole('button', { name: 'Find the hole' }))

describe('QuizGame — name the note', () => {
  beforeEach(() => {
    clock = 0
    localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('highlights a hole and accepts its note name', () => {
    renderGame()
    start()
    expect(screen.getByText('Which note is 1?')).toBeInTheDocument()
    expect(box('1 blow')).toHaveAttribute('data-highlight', 'target')
    expect(box('1 blow')).toHaveTextContent('1') // tab labels: the name isn't given away
    fireEvent.click(screen.getByRole('button', { name: 'C' }))
    expect(screen.getByText('✓ C')).toBeInTheDocument()
    expect(box('1 blow')).toHaveAttribute('data-highlight', 'correct')
  })

  it('can be played with a screen reader: the target is aria-current and named in the headline', () => {
    renderGame()
    start()
    expect(screen.getByText('Which note is 1?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1 blow', current: true })).toBe(box('1 blow'))
  })

  it('shows the right name after a wrong answer', () => {
    renderGame()
    start()
    fireEvent.click(screen.getByRole('button', { name: 'D' }))
    expect(screen.getByText('✗ It was C')).toBeInTheDocument()
    expect(box('1 blow')).toHaveAttribute('data-highlight', 'wrong')
  })

  it('always shows the 12 answers, enabled only while answering', () => {
    renderGame()
    expect(answers()).toHaveLength(12)
    expect(answers().every((b) => b.hasAttribute('disabled'))).toBe(true)
    start()
    expect(answers().some((b) => b.hasAttribute('disabled'))).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'C' }))
    expect(answers().every((b) => b.hasAttribute('disabled'))).toBe(true)
  })

  it('moves on 1.5 s after an answer, to a different hole', () => {
    vi.useFakeTimers()
    renderGame()
    start()
    fireEvent.click(screen.getByRole('button', { name: 'C' }))
    act(() => vi.advanceTimersByTime(1499))
    expect(screen.getByText('✓ C')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByText('Which note is -1?')).toBeInTheDocument()
    expect(box('-1 draw')).toHaveAttribute('data-highlight', 'target')
    expect(box('1 blow')).not.toHaveAttribute('data-highlight')
  })

  it('spells the answers for the harp key', () => {
    renderGame()
    expect(answers().map((b) => b.textContent)).toEqual([
      'C',
      'C#',
      'D',
      'D#',
      'E',
      'F',
      'F#',
      'G',
      'G#',
      'A',
      'A#',
      'B',
    ])
  })

  it('uses flats on a flat-key harp', () => {
    localStorage.setItem('harp-tools:settings', JSON.stringify({ key: 'F' }))
    renderGame([0], localStorage)
    expect(answers().map((b) => b.textContent)).toEqual([
      'C',
      'Db',
      'D',
      'Eb',
      'E',
      'F',
      'Gb',
      'G',
      'Ab',
      'A',
      'Bb',
      'B',
    ])
    start()
    fireEvent.click(screen.getByRole('button', { name: 'F' }))
    expect(screen.getByText('✓ F')).toBeInTheDocument()
  })

  it('spells the answers by the relative major on a natural-minor harp', () => {
    localStorage.setItem('harp-tools:settings', JSON.stringify({ tuning: 'naturalMinor' }))
    renderGame([0], localStorage)
    const names = answers().map((b) => b.textContent)
    expect(names).toContain('Eb')
    expect(names).toContain('Ab')
    expect(names).toContain('Bb')
    expect(names).not.toContain('D#')
    expect(names).not.toContain('G#')
    expect(names).not.toContain('A#')
  })

  it('does not take answers from the chart in this task', () => {
    renderGame()
    start()
    fireEvent.pointerDown(box('1 blow'))
    expect(screen.getByText('Which note is 1?')).toBeInTheDocument()
  })

  it('never lets the highlighted box announce its own note name', () => {
    renderGame()
    start()
    const chart = within(screen.getByRole('group', { name: 'Harmonica chart' }))
    for (const button of chart.getAllByRole('button')) {
      expect(button.getAttribute('aria-label')).not.toContain('C4')
    }
  })
})

describe('QuizGame — find the hole', () => {
  beforeEach(() => {
    clock = 0
    localStorage.clear()
  })

  it('asks for a note and accepts any hole with that exact pitch', () => {
    renderGame([0.2])
    findTask()
    start()
    expect(screen.getByTestId('target-note')).toHaveTextContent('G4')
    fireEvent.pointerDown(box('3 blow'))
    expect(screen.getByText('✓ G4 — 3')).toBeInTheDocument()
    expect(box('3 blow')).toHaveAttribute('data-highlight', 'correct')
  })

  it('marks a wrong hole and shows the right ones', () => {
    renderGame()
    findTask()
    start()
    fireEvent.pointerDown(box('-1 draw'))
    expect(screen.getByText('✗ C4 is 1')).toBeInTheDocument()
    expect(box('-1 draw')).toHaveAttribute('data-highlight', 'wrong')
    expect(box('1 blow')).toHaveAttribute('data-highlight', 'target')
  })

  it('ignores the chart before Start and after answering', () => {
    renderGame()
    findTask()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    fireEvent.pointerDown(box('1 blow'))
    expect(screen.queryByText(/✓|✗/)).toBeNull()
    start()
    fireEvent.pointerDown(box('1 blow'))
    fireEvent.pointerDown(box('-1 draw'))
    expect(screen.getByText(/✓ C4 — 1/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Round 2 of 10 · Score 200')
  })

  it('has no answer grid', () => {
    renderGame()
    findTask()
    expect(screen.queryByRole('group', { name: 'Answers' })).toBeNull()
  })

  it('only makes the chart interactive while a question is open', () => {
    renderGame()
    findTask()
    expect(box('1 blow')).not.toHaveAttribute('data-interactive')
    start()
    expect(box('1 blow')).toHaveAttribute('data-interactive', 'true')
    fireEvent.pointerDown(box('1 blow'))
    expect(box('-1 draw')).not.toHaveAttribute('data-interactive')
  })

  it('never lets a chart button announce the asked note, even the right one', () => {
    renderGame()
    findTask()
    start()
    expect(screen.getByTestId('target-note')).toHaveTextContent('C4')
    const chart = within(screen.getByRole('group', { name: 'Harmonica chart' }))
    for (const button of chart.getAllByRole('button')) {
      expect(button.getAttribute('aria-label')).not.toContain('C4')
    }
  })
})

describe('QuizGame — scored', () => {
  beforeEach(() => {
    clock = 0
    localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('scores a right answer by speed and a wrong one as 0', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    start()
    clock = 5000
    fireEvent.click(screen.getByRole('button', { name: 'C' }))
    expect(screen.getByText('✓ C · +150')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Round 2 of 10 · Score 150')
  })

  it('counts one answer per round, even on a double click', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    start()
    const c = screen.getByRole('button', { name: 'C' })
    act(() => {
      c.click()
      c.click()
    })
    expect(screen.getByRole('status')).toHaveTextContent('Round 2 of 10 · Score 200')
  })

  it('saves the best score under quiz, with the task in the key', () => {
    vi.useFakeTimers()
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    start()
    // rng 0 without repeats alternates between hole 1 blow (C) and hole 1 draw (D).
    for (let round = 0; round < 10; round++) {
      fireEvent.click(screen.getByRole('button', { name: round % 2 === 0 ? 'C' : 'D' }))
      act(() => vi.advanceTimersByTime(1500))
    }
    expect(screen.getByRole('status')).toHaveTextContent('Final score: 2000 / 2000')
    expect(loadBest(localStorage, 'quiz|adv=false|key=C|pool=1-10:plain|task=name')).toBe(2000)
  })
})

describe('QuizGame — layout and filters', () => {
  beforeEach(() => {
    clock = 0
    localStorage.clear()
  })

  it.each([
    ['Name the note', 'C'],
    ['Find the hole', '1 blow'],
  ])('keeps the same layout in every phase (%s)', (task, answer) => {
    const { container } = renderGame()
    fireEvent.click(screen.getByRole('button', { name: task }))
    const areas = ['[aria-label="Answers"] button', '[aria-label="Harmonica chart"]']
    const shape = layoutShape(container, areas)
    expect(shape.stageRows).toEqual(['P', 'DIV', 'P'])
    start()
    expect(layoutShape(container, areas)).toEqual(shape)
    const target = screen.getByRole('button', { name: answer })
    if (answer === 'C') fireEvent.click(target)
    else fireEvent.pointerDown(target)
    expect(screen.getByText(/^✓/)).toBeInTheDocument()
    expect(layoutShape(container, areas)).toEqual(shape)
  })

  it('says so when the filters leave no notes', () => {
    renderGame()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Blow / draw' }))
    expect(screen.getByRole('alert')).toHaveTextContent('No notes match these filters')
    expect(screen.queryByRole('button', { name: '▶ Start' })).toBeNull()
  })
})
