import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { HOME_GROUPS, entryHref } from './pages/homeGroups'

const timers = vi.hoisted(() => ({
  calls: [] as [string, { requireAudio?: boolean } | undefined][],
}))
vi.mock('./hooks/usePracticeTimer', () => ({
  usePracticeTimer: (pageId: string, opts?: { requireAudio?: boolean }) => {
    timers.calls.push([pageId, opts])
  },
}))

afterEach(() => {
  window.location.hash = ''
})

describe('App', () => {
  it('shows the home page with one card list per non-empty group', () => {
    window.location.hash = '#/'
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/diatonic harmonica/i)
    for (const group of HOME_GROUPS) {
      if (group.entries.length === 0) {
        expect(screen.queryByRole('list', { name: group.title })).toBeNull()
        continue
      }
      // The header nav also links to some pages, so look inside the card list.
      const list = screen.getByRole('list', { name: group.title })
      expect(
        within(list)
          .getAllByRole('link')
          .map((a) => a.getAttribute('href')),
      ).toEqual(group.entries.map(entryHref))
    }
  })

  it.each(HOME_GROUPS.flatMap((g) => g.entries.map((e) => [entryHref(e), e.title])))(
    'the Home card %s opens its own page',
    (hash) => {
      window.location.hash = hash
      render(<App />)
      expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent(/diatonic harmonica/i)
    },
  )

  it.each([
    ['#/echo', 'Echo the note'],
    ['#/bend', 'Bend trainer'],
    ['#/scales', 'Scale runner'],
    ['#/intervals', 'Interval ear training'],
    ['#/melody', 'Melody echo'],
  ])('routes %s to its game', (hash, title) => {
    window.location.hash = hash
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(title)
  })

  it('links to the GitHub repo from the header, in a new tab', () => {
    window.location.hash = '#/'
    render(<App />)
    const star = screen.getByRole('link', { name: /Star on GitHub/ })
    expect(star).toHaveAttribute('href', 'https://github.com/danilogiacomi/harp-tools')
    expect(star).toHaveAttribute('target', '_blank')
    expect(star).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('falls back to the home page for unknown routes', () => {
    window.location.hash = '#/nope'
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/diatonic harmonica/i)
  })
})

describe('practice time', () => {
  beforeEach(() => {
    timers.calls = []
  })

  it.each([
    ['#/tuner', 'tuner'],
    ['#/metronome', 'metronome'],
    ['#/echo', 'echo'],
    ['#/bend', 'bend'],
    ['#/scales', 'scales'],
    ['#/intervals', 'intervals'],
    ['#/melody', 'melody'],
    ['#/hole-finder', 'hole-finder'],
  ])('%s counts practice time under "%s", only while audio runs', (hash, pageId) => {
    window.location.hash = hash
    render(<App />)
    expect(timers.calls).toContainEqual([pageId, undefined])
  })

  it('the home page does not count practice time', () => {
    window.location.hash = '#/'
    render(<App />)
    expect(timers.calls).toEqual([])
  })

  it('#/positions counts visible time without audio', () => {
    window.location.hash = '#/positions'
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Positions & keys')
    expect(timers.calls).toContainEqual(['positions', { requireAudio: false }])
  })

  it('#/quiz counts visible time without audio', () => {
    window.location.hash = '#/quiz'
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Note quiz')
    expect(timers.calls).toContainEqual(['quiz', { requireAudio: false }])
  })
})
