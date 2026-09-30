import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { maxScore } from '../../../core/arcade/arcadeScore'
import { TRACKS } from '../../../core/arcade/tracks'
import { buildHarp } from '../../../core/harmonica/harp'
import { localDate } from '../../../core/log/dates'
import { parseTab, tabTimeline } from '../../../core/tab/parseTab'
import { fakeBand } from '../../../test/fakeBackingScheduler'
import { fakeAudio, hold } from '../../../test/fakeGameAudio'
import { layoutShape } from '../../../test/layout'
import { loadLog } from '../../log/practiceLog'
import { loadBest } from '../../scores/bestScores'
import { SettingsProvider, useSettings } from '../../settings/SettingsContext'
import { HeroGame } from './HarpHeroPage'

vi.mock('../../hooks/useGameAudio', () => import('../../../test/fakeGameAudio'))
vi.mock(
  '../../../audio/backing/BackingScheduler',
  () => import('../../../test/fakeBackingScheduler'),
)

// Porch Shuffle at 80 BPM: 750 ms a beat, 3 s a bar. The tests hear the count-in bar at 1000 ms,
// so the first note is due at 4000 ms. Mic onsets arrive 60 ms late (the detection latency).
const PORCH = tabTimeline(parseTab(TRACKS[0].part, buildHarp('C')).items).notes
const T0 = 4000
const BEAT = 750
const BEST_KEY = 'hero|track=porch-shuffle'

function Settings() {
  const { update } = useSettings()
  return (
    <>
      <button type="button" onClick={() => update({ key: 'D' })}>
        set key D
      </button>
      <button type="button" onClick={() => update({ tuning: 'paddy' })}>
        set Paddy tuning
      </button>
    </>
  )
}

const renderGame = () =>
  render(
    <SettingsProvider storage={null}>
      <Settings />
      <HeroGame storage={localStorage} />
    </SettingsProvider>,
  )
const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
const scored = () => press('Scored')
/** The band's bar `n` is heard at `ms` on the page's clock. */
const bar = (n: number, ms: number) =>
  act(() => {
    fakeAudio.time = ms
    fakeBand.onBar?.(n)
  })
/** Starts the song and hears its count-in bar at 1000 ms. */
const startSong = () => {
  press('▶ Start')
  bar(-1, 1000)
}
/** Plays Porch Shuffle's note `i`, `lateMs` after it is due, for 300 ms. */
const play = (i: number, lateMs = 0) => {
  const at = T0 + PORCH[i].startBeat * BEAT + 60 + lateMs
  hold(PORCH[i].note.midi, at, at + 300)
}
const playAll = () => PORCH.forEach((_, i) => play(i))
/** The stage's first line (the hidden live region says the same thing for screen readers). */
const headline = () => document.querySelector('.stageSplit .headline')
const scoreRow = () => screen.getByRole('group', { name: 'Score' })
const meter = () => screen.getByRole('meter', { name: 'Rock meter' })
const fmt = (n: number) => n.toLocaleString('en-US')

describe('HeroGame', () => {
  beforeEach(() => {
    fakeAudio.reset()
    fakeBand.reset()
    localStorage.clear()
  })

  it('starts the band in 2nd position after a bar of count-in, once through', () => {
    renderGame()
    expect(screen.getByRole('combobox', { name: 'Track' })).toHaveDisplayValue(
      'Porch Shuffle · ●○○○○ · ☆☆☆☆☆',
    )
    press('▶ Start')
    expect(fakeBand).toMatchObject({ starts: 1, running: true })
    expect(fakeBand.config).toMatchObject({
      bpm: 80,
      feel: 'shuffle',
      tonicPc: 7,
      countInBars: 1,
      loop: false,
    })
    expect(fakeBand.config?.form).toHaveLength(24)
    expect(headline()).toHaveTextContent('Next: 6 (G5)')
    expect(screen.getByRole('button', { name: '6 G5' })).toHaveAttribute('data-highlight', 'target')
  })

  it('ignores the mic until the band’s first bar is heard', () => {
    renderGame()
    press('▶ Start')
    hold(79, 0, 3000)
    expect(headline()).toHaveTextContent('Next: 6 (G5)')
    expect(scoreRow()).toHaveTextContent('Score 0')
  })

  it('grades each note against the band and scores it with the combo', () => {
    const { container } = renderGame()
    startSong()
    play(0) // on time: Perfect, 100
    expect(screen.getByText('Perfect')).toBeInTheDocument()
    play(1, 100) // 100 ms late: Good, 75
    expect(scoreRow()).toHaveTextContent('Score 175')
    expect(scoreRow()).toHaveTextContent('Combo 2')
    expect(scoreRow()).toHaveTextContent('×1')
    expect(meter()).toHaveAttribute('aria-valuenow', '55')
    expect(screen.getByText('Good')).toBeInTheDocument()
    expect(headline()).toHaveTextContent('Next: -4 (D5)')
    expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent('Good. Next: -4 (D5)')
    expect(container.querySelectorAll('.note[data-state="perfect"]')).toHaveLength(1)
    expect(container.querySelectorAll('.note[data-state="good"]')).toHaveLength(1)
  })

  it('drops the combo and drains the meter on a miss', () => {
    renderGame()
    startSong()
    play(0)
    hold(null, 4400, 7300) // note 1, due at 7000 ms, goes by unplayed
    expect(scoreRow()).toHaveTextContent('Combo 0')
    expect(meter()).toHaveAttribute('aria-valuenow', '45') // 50 + 3 − 8
    expect(screen.getByText('Miss')).toBeInTheDocument()
  })

  it('fails a scored song when the meter runs out, and saves nothing', () => {
    renderGame()
    scored()
    startSong()
    hold(null, 4000, 17000) // seven notes go by: the seventh empties the meter at 16250 ms
    expect(screen.getByText('Song failed at bar 5 of 24')).toBeInTheDocument()
    expect(screen.getByText('Perfect 0 · Good 0 · Miss 7 · Longest streak 0')).toBeInTheDocument()
    expect(fakeBand.running).toBe(false)
    expect(loadBest(localStorage, BEST_KEY)).toBeNull()
    expect(loadLog(localStorage).sessions).toEqual([])
    expect(screen.getByRole('button', { name: '↻ Retry' })).toBeInTheDocument()
  })

  it('saves nothing when a hidden tab brings the rest of a scored song in as misses at once', () => {
    renderGame()
    scored()
    startSong()
    play(0)
    hold(null, 200000, 200000) // the tab comes back long after the end: every note left is a miss
    // One Perfect (meter 53), then the 7th miss empties it: note 7, due at beat 20, in bar 6.
    expect(headline()).toHaveTextContent('Song failed at bar 6 of 24')
    expect(screen.getByText('Perfect 1 · Good 0 · Miss 7 · Longest streak 1')).toBeInTheDocument()
    expect(loadBest(localStorage, BEST_KEY)).toBeNull()
    expect(loadLog(localStorage).sessions).toEqual([])
  })

  it('keeps going in practice with an empty meter', () => {
    renderGame()
    startSong()
    hold(null, 4000, 17000)
    expect(meter()).toHaveAttribute('aria-valuenow', '0')
    expect(screen.getByRole('button', { name: '■ Stop' })).toBeInTheDocument()
    expect(fakeBand.running).toBe(true)
  })

  it('finishes a scored song with stars, a best and a log entry, and lets the band play out', () => {
    renderGame()
    scored()
    startSong()
    playAll()
    const max = maxScore(PORCH.length)
    expect(screen.getByText(`★★★★★ Score ${fmt(max)} · 🏆 New best!`)).toBeInTheDocument()
    expect(loadBest(localStorage, BEST_KEY)).toBe(max)
    expect(loadLog(localStorage).sessions).toEqual([
      { date: localDate(Date.now()), game: 'hero', score: max, max },
    ])
    expect(screen.getByRole('combobox', { name: 'Track' })).toHaveDisplayValue(
      'Porch Shuffle · ●○○○○ · ★★★★★',
    )
    expect(fakeBand.running).toBe(true) // its last bar is still playing
    bar(24, 76000) // the song's end
    expect(fakeBand.running).toBe(false)
    expect(screen.getByRole('button', { name: '▶ Again' })).toBeInTheDocument()
  })

  it('starts again from the top while the band is still playing out', () => {
    renderGame()
    startSong()
    playAll()
    expect(screen.getByText(`★★★★★ Score ${fmt(maxScore(PORCH.length))}`)).toBeInTheDocument()
    press('▶ Again')
    expect(fakeBand).toMatchObject({ starts: 2, stops: 1, running: true })
    expect(headline()).toHaveTextContent('Next: 6 (G5)')
    expect(scoreRow()).toHaveTextContent('Score 0')
  })

  it('offers a slower speed in practice only', () => {
    renderGame()
    fireEvent.change(screen.getByRole('combobox', { name: 'Speed' }), {
      target: { value: '0.75' },
    })
    press('▶ Start')
    expect(fakeBand.config?.bpm).toBe(60)
    scored()
    expect(screen.queryByRole('combobox', { name: 'Speed' })).toBeNull()
    press('▶ Start')
    expect(fakeBand.config?.bpm).toBe(80)
  })

  it('stops the band when a setting changes mid-song', () => {
    renderGame()
    startSong()
    press('set key D')
    expect(fakeBand).toMatchObject({ running: false, disposes: 1 })
    expect(screen.getByRole('button', { name: '▶ Start' })).toBeInTheDocument()
  })

  it('reports a track this tuning can’t play, and offers no Start', () => {
    renderGame()
    press('set Paddy tuning')
    fireEvent.change(screen.getByRole('combobox', { name: 'Track' }), {
      target: { value: 'overdrive' },
    })
    expect(screen.getByRole('alert')).toHaveTextContent("This track can't be played on this harp:")
    expect(screen.queryByRole('button', { name: '▶ Start' })).toBeNull()
    expect(screen.getByText(/Written for a Richter harp/)).toBeInTheDocument()
  })

  it('suggests headphones', () => {
    renderGame()
    expect(
      screen.getByText("Headphones help: the band's chords can sound like harp notes to the mic."),
    ).toBeInTheDocument()
  })

  it('keeps the same layout in every phase', () => {
    const { container } = renderGame()
    const shape = () =>
      layoutShape(container, ['.lane', '.note', '[role="meter"]', '[aria-live]', '.grade'])
    const idle = shape()
    expect(idle.areas['.lane']).toBe(10)
    press('▶ Start')
    expect(shape()).toEqual(idle)
    bar(-1, 1000)
    play(0)
    expect(shape()).toEqual(idle)
  })

  describe('the highway', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('moves with the band’s clock, and freezes where the song failed', () => {
      const { container } = renderGame()
      const offset = () =>
        parseFloat(
          (container.querySelector('.highway') as HTMLElement).style.getPropertyValue('--offset'),
        )
      scored()
      startSong()
      fakeAudio.time = 2500 // 1.5 s after the count-in started: 2 beats
      act(() => vi.advanceTimersByTime(20))
      expect(offset()).toBeCloseTo(2 * 48)
      hold(null, 4000, 17000) // the 7th miss (due at beat 16) empties the meter
      fakeAudio.time = 30000
      act(() => vi.advanceTimersByTime(20))
      // Frozen where that note's window closed: count-in + beat 16 + 150 ms.
      expect(offset()).toBeCloseTo((4 + 16 + 150 / BEAT) * 48)
    })
  })
})
