import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DayChart } from './DayChart'

const days = [
  { date: '2026-09-26', seconds: 0 },
  { date: '2026-09-27', seconds: 90 },
  { date: '2026-09-28', seconds: 1500 },
]

describe('DayChart', () => {
  it('draws one labelled bar per day, tallest for the most minutes', () => {
    const { container } = render(<DayChart days={days} />)
    const bars = [...container.querySelectorAll('[data-testid="day-bar"]')]
    expect(bars).toHaveLength(3)
    const heights = bars.map((g) => Number(g.querySelector('rect')!.getAttribute('height')))
    expect(heights[0]).toBe(0)
    expect(heights[2]).toBe(100)
    expect(heights[1]).toBeGreaterThan(0)
    expect(bars.map((g) => g.querySelectorAll('text')[0].textContent)).toEqual(['', '2', '25'])
    expect(bars.map((g) => g.querySelectorAll('text')[1].textContent)).toEqual(['26', '27', '28'])
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('has a table with the same numbers for screen readers', () => {
    render(<DayChart days={days} />)
    const table = screen.getByRole('table', { name: 'Minutes practised per day' })
    expect(table).toHaveClass('visually-hidden')
    const rows = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((r) => [...r.children].map((c) => c.textContent))
    expect(rows).toEqual([
      ['2026-09-26', '0'],
      ['2026-09-27', '2'],
      ['2026-09-28', '25'],
    ])
  })
})
