import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from './App'

afterEach(() => {
  window.location.hash = ''
})

describe('App', () => {
  it('shows the home page with links to the tools and games', () => {
    window.location.hash = '#/'
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/diatonic harmonica/i)
    // The header nav also links to the tools, so look inside the card lists.
    const tools = screen.getByRole('list', { name: 'Tools' })
    expect(within(tools).getByRole('link', { name: /Tuner/ })).toHaveAttribute('href', '#/tuner')
    expect(within(tools).getByRole('link', { name: /Metronome/ })).toHaveAttribute(
      'href',
      '#/metronome',
    )
    const games = screen.getByRole('list', { name: 'Games' })
    expect(
      within(games)
        .getAllByRole('link')
        .map((a) => a.getAttribute('href')),
    ).toEqual(['#/echo', '#/bend', '#/scales', '#/intervals', '#/melody'])
    expect(screen.queryByText('Coming soon')).toBeNull()
  })

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
