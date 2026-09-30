import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NoteSlots, scrollLeftToShow, type NoteSlot } from './NoteSlots'

describe('scrollLeftToShow', () => {
  const view = { scrollLeft: 0, width: 300 }
  it('leaves a visible slot alone', () => {
    expect(scrollLeftToShow({ left: 100, width: 56 }, view)).toBeNull()
  })
  it('scrolls right to a slot past the right edge, keeping a margin before it', () => {
    expect(scrollLeftToShow({ left: 400, width: 56 }, view)).toBe(392)
  })
  it('scrolls back to a slot left of the view', () => {
    expect(scrollLeftToShow({ left: 20, width: 56 }, { scrollLeft: 200, width: 300 })).toBe(12)
  })
  it('never goes below 0', () => {
    expect(scrollLeftToShow({ left: 4, width: 56 }, { scrollLeft: 100, width: 300 })).toBe(0)
  })
})

const slots = (current: number, n = 10): NoteSlot[] =>
  Array.from({ length: n }, (_, i) => ({
    label: String(i + 1),
    state: i < current ? 'done' : i === current ? 'current' : 'todo',
  }))

describe('NoteSlots', () => {
  it('scrolls its own row, not the page, to the current slot', () => {
    const { rerender } = render(<NoteSlots label="Lick" slots={slots(0)} />)
    const list = screen.getByRole('list', { name: 'Lick' })
    // jsdom has no layout: give the row and its 8th slot some geometry.
    Object.defineProperty(list, 'clientWidth', { value: 300 })
    Object.defineProperty(list, 'scrollLeft', { value: 0, writable: true })
    const eighth = list.children[7] as HTMLElement
    Object.defineProperty(eighth, 'offsetLeft', { value: 448 })
    Object.defineProperty(eighth, 'offsetWidth', { value: 56 })

    rerender(<NoteSlots label="Lick" slots={slots(7)} />)
    expect(list.scrollLeft).toBe(440)
  })
})
