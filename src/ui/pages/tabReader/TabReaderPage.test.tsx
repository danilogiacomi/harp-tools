import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { textHash } from '../../../core/tab/parseTab'
import { fakeAudio, hold } from '../../../test/fakeGameAudio'
import { layoutShape } from '../../../test/layout'
import { loadBest } from '../../scores/bestScores'
import { SettingsProvider, useSettings } from '../../settings/SettingsContext'
import { YOUR_TAB_KEY } from '../../tab/yourTab'
import { TabReaderGame } from './TabReaderPage'

vi.mock('../../hooks/useGameAudio', () => import('../../../test/fakeGameAudio'))
// The metronome's first beat was heard at 1000 ms. At 120 BPM (set by the test) a 4-beat
// count-in ends at 3000, where the song starts.
const metronome = vi.hoisted(() => ({
  running: false,
  beat: null as number | null,
  lastBeatMs: 1000 as number | null,
  toggle: () => {
    metronome.running = !metronome.running
  },
}))
vi.mock('../../hooks/useMetronome', () => ({ useMetronome: () => metronome }))

function Tempo() {
  const { update } = useSettings()
  return (
    <>
      <button type="button" onClick={() => update({ bpm: 120 })}>
        set 120 BPM
      </button>
      <button type="button" onClick={() => update({ bpm: 100 })}>
        set 100 BPM
      </button>
    </>
  )
}

const renderGame = (tab = '4 -4 5') => {
  localStorage.setItem(YOUR_TAB_KEY, tab)
  const result = render(
    <SettingsProvider storage={null}>
      <Tempo />
      <TabReaderGame storage={localStorage} />
    </SettingsProvider>,
  )
  fireEvent.change(screen.getByRole('combobox', { name: 'Song' }), { target: { value: 'custom' } })
  return result
}
const start = () => fireEvent.click(screen.getByRole('button', { name: '▶ Start' }))
const slots = () =>
  within(screen.getByRole('list', { name: 'Next notes' }))
    .getAllByRole('listitem')
    .map((li) => `${li.textContent}:${li.dataset.state}`)

describe('TabReaderGame', () => {
  beforeEach(() => {
    fakeAudio.reset()
    localStorage.clear()
    metronome.running = false
  })

  it('waits for each note in practice', () => {
    renderGame()
    start()
    expect(screen.getByText('Next: 4 (C5)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '4 C5' })).toHaveAttribute('data-highlight', 'target')
    expect(metronome.running).toBe(false)
    hold(72, 0, 250)
    expect(screen.getByText('Next: -4 (D5)')).toBeInTheDocument()
    expect(slots().slice(0, 3)).toEqual(['4:done', '-4:current', '5:todo'])
    hold(74, 300, 550)
    hold(76, 600, 850)
    expect(screen.getByText('✓ Done — 3 of 3 notes')).toBeInTheDocument()
  })

  it('waits for a break between repeated notes (Mary: 5 5 5)', () => {
    renderGame('5 5 5:2 -4')
    start()
    hold(76, 0, 650) // one unbroken breath
    expect(screen.getByText(/^Note \d of 4/)).toHaveTextContent('Note 2 of 4')
    hold(null, 700, 700)
    hold(76, 750, 1000)
    expect(screen.getByText(/^Note \d of 4/)).toHaveTextContent('Note 3 of 4')
    hold(null, 1050, 1050)
    hold(76, 1100, 1350)
    expect(screen.getByText('Next: -4 (D5)')).toBeInTheDocument()
  })

  it('scores notes at tempo by their timing, and saves the best per tab', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    fireEvent.click(screen.getByRole('button', { name: 'set 120 BPM' }))
    start()
    expect(metronome.running).toBe(true)
    expect(screen.getByRole('status')).toHaveTextContent('Round 1 of 3')
    hold(72, 3060, 3360) // on time: 100
    hold(74, 3610, 3910) // 50 ms late: 100
    hold(76, 4160, 4460) // 100 ms late: 75
    expect(screen.getByRole('status')).toHaveTextContent('Final score: 275 / 300')
    expect(metronome.running).toBe(false)
    expect(loadBest(localStorage, `tab-reader|song=custom-${textHash('4 -4 5')}`)).toBe(275)
  })

  it('reports tab errors and offers no Start', () => {
    renderGame("4 x 4'")
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Token 2 “x” is not a note, rest (_) or bar line (|).')
    expect(alert).toHaveTextContent("Token 3 “4'” isn't on this harp.")
    expect(screen.queryByRole('button', { name: '▶ Start' })).toBeNull()
  })

  it('says so when the tab has no notes', () => {
    renderGame('_ | _:2 |')
    expect(screen.getByRole('alert')).toHaveTextContent('This tab has no notes yet.')
  })

  it('keeps your tab between visits', () => {
    const { unmount } = renderGame('4 -4 5')
    fireEvent.change(screen.getByRole('textbox', { name: /Your tab/ }), {
      target: { value: '6 -6 7' },
    })
    expect(localStorage.getItem(YOUR_TAB_KEY)).toBe('6 -6 7')
    unmount()
    render(
      <SettingsProvider storage={null}>
        <TabReaderGame storage={localStorage} />
      </SettingsProvider>,
    )
    fireEvent.change(screen.getByRole('combobox', { name: 'Song' }), {
      target: { value: 'custom' },
    })
    expect(screen.getByRole('textbox', { name: /Your tab/ })).toHaveValue('6 -6 7')
  })

  it('stops the song when the tempo changes', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'Scored' }))
    fireEvent.click(screen.getByRole('button', { name: 'set 120 BPM' }))
    start()
    hold(72, 3060, 3360)
    fireEvent.click(screen.getByRole('button', { name: 'set 100 BPM' }))
    expect(screen.getByRole('button', { name: '▶ Start' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Round 1 of 3 · Score 0')
  })

  it.each(['Practice', 'Scored'])('keeps the same layout in every phase (%s)', (mode) => {
    const { container } = renderGame()
    fireEvent.click(screen.getByRole('button', { name: mode }))
    fireEvent.click(screen.getByRole('button', { name: 'set 120 BPM' }))
    const shape = () => layoutShape(container, ['[aria-label="Next notes"] li', '.lane', '.note'])
    const idle = shape()
    expect(idle.areas['[aria-label="Next notes"] li']).toBe(6)
    start()
    expect(shape()).toEqual(idle)
    const t0 = mode === 'Scored' ? 3060 : 0
    hold(72, t0, t0 + 300)
    expect(shape()).toEqual(idle)
  })

  describe('the lane', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('scrolls at tempo and stops at the note it waits for', () => {
      const { container } = renderGame()
      const track = () => (container.querySelector('.track') as HTMLElement).style.transform
      start()
      // 90 BPM default: 666.7 ms a beat; 4-beat count-in, first note at beat 4.
      fakeAudio.time = 1000
      act(() => vi.advanceTimersByTime(20))
      expect(track()).toBe(`translateX(${96 - 1.5 * 64}px)`)
      fakeAudio.time = 10000
      act(() => vi.advanceTimersByTime(20))
      expect(track()).toBe(`translateX(${96 - 4 * 64}px)`)
    })
  })
})
