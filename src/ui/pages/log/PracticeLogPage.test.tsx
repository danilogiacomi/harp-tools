import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { layoutShape } from '../../../test/layout'
import { LOG_KEY } from '../../log/practiceLog'
import { PracticeLogPage } from './PracticeLogPage'

const NOON = new Date(2026, 8, 27, 12, 0, 0).getTime() // Sunday 27 September 2026
const LOG = {
  days: {
    '2026-09-27': { tuner: 600, echo: 300 },
    '2026-09-26': { quiz: 120 },
    '2026-09-25': { positions: 90 },
    '2026-09-21': { bend: 1200 }, // Monday of this week
    '2026-09-20': { melody: 3600 }, // last week
  },
  sessions: [
    { date: '2026-09-26', game: 'echo', score: 1450, max: 2000 },
    { date: '2026-09-27', game: 'quiz', score: 1800, max: 2000 },
  ],
}

const renderPage = () => render(<PracticeLogPage now={() => NOON} />)
const stats = (container: HTMLElement) =>
  [...container.querySelectorAll('dl dt')].map((dt) => [
    dt.textContent,
    dt.nextElementSibling?.textContent,
  ])
const rowsOf = (name: string) =>
  within(screen.getByRole('table', { name }))
    .getAllByRole('row')
    .slice(1)
    .map((r) => [...r.children].map((c) => c.textContent))
const SHAPE_AREAS = ['h2', 'dl dt', '[data-testid="day-bar"]', 'table']

describe('PracticeLogPage', () => {
  beforeEach(() => localStorage.clear())

  it('shows streaks and totals', () => {
    localStorage.setItem(LOG_KEY, JSON.stringify(LOG))
    const { container } = renderPage()
    expect(stats(container)).toEqual([
      ['Current streak', '3 days'],
      ['Longest streak', '3 days'],
      ['Today', '15 min'],
      ['This week', '38 min'],
      ['All time', '1 h 38 min'],
    ])
  })

  it('charts the last 14 days', () => {
    localStorage.setItem(LOG_KEY, JSON.stringify(LOG))
    const { container } = renderPage()
    expect(container.querySelectorAll('[data-testid="day-bar"]')).toHaveLength(14)
    const minutes = rowsOf('Minutes practised per day')
    expect(minutes[0]).toEqual(['2026-09-14', '0'])
    expect(minutes[6]).toEqual(['2026-09-20', '60'])
    expect(minutes[13]).toEqual(['2026-09-27', '15'])
  })

  it('lists time per page this week, by page name', () => {
    localStorage.setItem(LOG_KEY, JSON.stringify(LOG))
    renderPage()
    expect(rowsOf('This week by page')).toEqual([
      ['Bend trainer', '20 min'],
      ['Tuner', '10 min'],
      ['Echo the note', '5 min'],
      ['Note quiz', '2 min'],
      ['Positions & keys', '1 min'],
    ])
  })

  it('lists recent scored sessions, newest first', () => {
    localStorage.setItem(LOG_KEY, JSON.stringify(LOG))
    renderPage()
    expect(rowsOf('Recent scored sessions')).toEqual([
      ['2026-09-27', 'Note quiz', '1800 / 2000'],
      ['2026-09-26', 'Echo the note', '1450 / 2000'],
    ])
  })

  it('clears the log only after confirming', () => {
    localStorage.setItem(LOG_KEY, JSON.stringify(LOG))
    const { container } = renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Clear log' }))
    expect(screen.getByText("Clear the whole log? This can't be undone.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(localStorage.getItem(LOG_KEY)).not.toBeNull()
    expect(stats(container)[0]).toEqual(['Current streak', '3 days'])

    fireEvent.click(screen.getByRole('button', { name: 'Clear log' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes, clear the log' }))
    expect(localStorage.getItem(LOG_KEY)).toBeNull()
    expect(stats(container)[0]).toEqual(['Current streak', '0 days'])
    expect(rowsOf('This week by page')).toEqual([['Nothing yet this week.']])
    expect(screen.getByRole('button', { name: 'Clear log' })).toBeInTheDocument()
  })

  it('shows an empty log with the same layout as a full one', () => {
    const empty = renderPage()
    const emptyShape = layoutShape(empty.container, SHAPE_AREAS)
    expect(rowsOf('Recent scored sessions')).toEqual([['No scored sessions yet.']])
    expect(stats(empty.container)[2]).toEqual(['Today', '0 s'])
    empty.unmount()

    localStorage.setItem(LOG_KEY, JSON.stringify(LOG))
    const full = renderPage()
    expect(layoutShape(full.container, SHAPE_AREAS)).toEqual(emptyShape)
  })

  it('treats a corrupt log as empty', () => {
    localStorage.setItem(LOG_KEY, '{nope')
    const { container } = renderPage()
    expect(stats(container)[4]).toEqual(['All time', '0 s'])
  })
})
