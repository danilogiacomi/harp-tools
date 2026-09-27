import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { localDate } from '../../../core/log/dates'
import { layoutShape } from '../../../test/layout'
import { loadLog } from '../../log/practiceLog'
import { SettingsProvider, useSettings } from '../../settings/SettingsContext'
import { PositionsPage } from './PositionsPage'

function SetHeaderKey() {
  const { update } = useSettings()
  return (
    <button type="button" onClick={() => update({ key: 'F' })}>
      header F
    </button>
  )
}

const renderPage = () =>
  render(
    <SettingsProvider storage={null}>
      <SetHeaderKey />
      <PositionsPage />
    </SettingsProvider>,
  )
const recommendation = () => screen.getByTestId('recommendation').textContent
const choose = (name: string, value: string) =>
  fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } })
const tableRows = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((r) => [...r.children].map((c) => c.textContent))

describe('PositionsPage — I have a song in…', () => {
  it('recommends a C harp for a G blues by default', () => {
    const { container } = renderPage()
    expect(recommendation()).toBe('Use a C harp — 2nd position (Mixolydian)')
    expect(container.querySelector('tr[data-recommended]')).toHaveTextContent('2nd')
  })

  it('recommends a G harp for an A minor song (3rd position)', () => {
    renderPage()
    choose('Song key', '9')
    choose('Style', 'minor')
    expect(recommendation()).toBe('Use a G harp — 3rd position (Dorian)')
  })

  it('lists every position with its harp, mode and typical use', () => {
    renderPage()
    expect(screen.getByRole('table')).toHaveTextContent('Every position for a song in G')
    expect(tableRows()).toEqual([
      ['1st', 'G harp', 'Ionian', 'major, folk'],
      ['2nd', 'C harp', 'Mixolydian', 'blues, rock, country'],
      ['3rd', 'F harp', 'Dorian', 'minor blues'],
      ['4th', 'Bb harp', 'Aeolian', 'natural minor'],
      ['5th', 'Eb harp', 'Phrygian', '—'],
      ['12th', 'D harp', 'Lydian', '—'],
    ])
  })

  it('names song keys the way keys are written', () => {
    renderPage()
    const options = [
      ...screen.getByRole('combobox', { name: 'Song key' }).querySelectorAll('option'),
    ]
    expect(options.map((o) => o.textContent)).toEqual([
      'C',
      'Db',
      'D',
      'Eb',
      'E',
      'F',
      'F#',
      'G',
      'Ab',
      'A',
      'Bb',
      'B',
    ])
  })

  it('with "Show all", suggests the most played positions and marks no row', () => {
    const { container } = renderPage()
    choose('Style', 'all')
    expect(recommendation()).toBe('Most played: G harp (1st) · C harp (2nd) · F harp (3rd)')
    expect(container.querySelector('tr[data-recommended]')).toBeNull()
  })

  it('keeps its layout when the song or style changes', () => {
    const { container } = renderPage()
    const areas = [
      'tbody tr',
      '[data-testid="recommendation"]',
      'caption',
      '[data-testid="harp-summary"]',
    ]
    const shape = layoutShape(container, areas)
    choose('Style', 'all')
    expect(layoutShape(container, areas)).toEqual(shape)
    choose('Song key', '1')
    choose('Style', 'naturalMinor')
    expect(layoutShape(container, areas)).toEqual(shape)
  })
})

describe('PositionsPage — I have a … harp', () => {
  it('starts at the header key and says what each position plays', () => {
    renderPage()
    expect(screen.getByTestId('harp-summary')).toHaveTextContent(
      'C harp: 1st C major · 2nd G blues · 3rd D minor · 4th A minor · 5th E Phrygian · 12th F Lydian',
    )
  })

  it('spells tonics the way the chosen harp does', () => {
    renderPage()
    choose('Harp', 'A')
    expect(screen.getByTestId('harp-summary')).toHaveTextContent(
      'A harp: 1st A major · 2nd E blues · 3rd B minor · 4th F# minor · 5th C# Phrygian · 12th D Lydian',
    )
  })

  it('follows the header key when that changes', () => {
    renderPage()
    choose('Harp', 'A')
    fireEvent.click(screen.getByRole('button', { name: 'header F' }))
    expect(screen.getByTestId('harp-summary')).toHaveTextContent(
      'F harp: 1st F major · 2nd C blues · 3rd G minor · 4th D minor · 5th A Phrygian · 12th Bb Lydian',
    )
  })
})

describe('PositionsPage — practice time', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('counts visible time without needing audio', () => {
    localStorage.clear() // earlier tests' unmounts may have logged a few real milliseconds
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 27, 10, 0, 0))
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    renderPage()
    act(() => vi.advanceTimersByTime(15_000))
    expect(loadLog(localStorage).days[localDate(Date.now())]).toEqual({ positions: 15 })
  })
})
