import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildHarp } from '../../../core/harmonica/harp'
import { parseTab, tabTimeline } from '../../../core/tab/parseTab'
import { Highway, PX_PER_BEAT, type NoteState } from './Highway'

// 4 (2 beats) at beat 0, -4 at 2, -3' at 3, then 6o (4 beats) at 4; after a 4-beat count-in.
const { notes } = tabTimeline(parseTab("4:2 -4 -3' | 6o:4", buildHarp('C')).items)
const renderHighway = (
  states: NoteState[] = notes.map(() => 'todo'),
  position: () => number = () => 0,
) =>
  render(
    <Highway
      notes={notes}
      countInBeats={4}
      totalBars={2}
      beatsPerBar={4}
      barsPerChorus={12}
      states={states}
      position={position}
    />,
  )
const px = (beats: number) => `${beats * PX_PER_BEAT}px`
const lane = (c: HTMLElement, hole: number) =>
  c.querySelector(`.lane[data-hole="${hole}"]`) as HTMLElement
const notesIn = (c: HTMLElement, hole: number) =>
  [...lane(c, hole).querySelectorAll('.note')] as HTMLElement[]

describe('Highway', () => {
  it('has the label spacer, then a lane per hole, hidden from screen readers', () => {
    const { container } = renderHighway()
    const root = container.querySelector('.highway') as HTMLElement
    expect(root).toHaveAttribute('aria-hidden', 'true')
    expect(root.firstElementChild).toHaveClass('spacer')
    const lanes = [...root.querySelectorAll(':scope > .lane')] as HTMLElement[]
    expect(lanes.map((l) => l.dataset.hole)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
    ])
  })

  it('puts each note in its hole’s lane, at its beat, as tall as it lasts', () => {
    const { container } = renderHighway()
    const [blow, draw] = notesIn(container, 4)
    expect(notesIn(container, 4)).toHaveLength(2)
    expect(blow).toHaveTextContent('4')
    expect(blow.dataset).toMatchObject({ color: 'blow', breath: 'blow' })
    expect(blow.style.bottom).toBe(px(4))
    expect(blow.style.height).toBe(`${2 * PX_PER_BEAT - 4}px`)
    expect(draw.dataset).toMatchObject({ color: 'draw', breath: 'draw' })
    expect(draw.style.bottom).toBe(px(6))
    const [bend] = notesIn(container, 3)
    expect(bend).toHaveTextContent("-3'")
    expect(bend.dataset).toMatchObject({ color: 'bend', breath: 'draw' })
    const [over] = notesIn(container, 6)
    expect(over.dataset).toMatchObject({ color: 'overblow', breath: 'blow' })
    expect(over.style.height).toBe(`${4 * PX_PER_BEAT - 4}px`)
  })

  it('marks judged notes', () => {
    const { container } = renderHighway(['perfect', 'miss', 'good', 'todo'])
    expect(notesIn(container, 4).map((n) => n.dataset.state)).toEqual(['perfect', 'miss'])
    expect(notesIn(container, 3)[0].dataset.state).toBe('good')
    expect(notesIn(container, 6)[0].dataset.state).toBe('todo')
  })

  it('draws a rule every bar, stronger at each chorus, and labels the count-in', () => {
    const { container } = renderHighway()
    const rules = [...container.querySelectorAll('.rule')] as HTMLElement[]
    expect(rules.map((r) => r.style.bottom)).toEqual([px(4), px(8), px(12)])
    expect(rules.map((r) => r.dataset.chorus)).toEqual(['true', undefined, undefined])
    expect(container.querySelector('.countIn')).toHaveTextContent('count-in')
    expect(container.querySelector('.strike')).not.toBeNull()
  })

  describe('motion', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('slides the lanes down to the position on each frame', () => {
      let beats = 0
      const { container } = renderHighway(undefined, () => beats)
      const root = container.querySelector('.highway') as HTMLElement
      beats = 2.5
      act(() => vi.advanceTimersByTime(20))
      expect(root.style.getPropertyValue('--offset')).toBe(px(2.5))
    })
  })
})
