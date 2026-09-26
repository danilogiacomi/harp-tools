import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from './App'

afterEach(() => {
  window.location.hash = ''
})

describe('App', () => {
  it('shows the home page with the tools and upcoming games', () => {
    window.location.hash = '#/'
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/diatonic harmonica/i)
    // The header nav also links to the tools, so look inside the Tools card list.
    const tools = screen.getByRole('list', { name: 'Tools' })
    expect(within(tools).getByRole('link', { name: /Tuner/ })).toHaveAttribute('href', '#/tuner')
    expect(within(tools).getByRole('link', { name: /Metronome/ })).toHaveAttribute(
      'href',
      '#/metronome',
    )
    expect(screen.getAllByText('Coming soon')).toHaveLength(5)
  })

  it('falls back to the home page for unknown routes', () => {
    window.location.hash = '#/nope'
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/diatonic harmonica/i)
  })
})
