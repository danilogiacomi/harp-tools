import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SettingsProvider, useSettings } from '../settings/SettingsContext'
import { Header } from './Header'

function Probe() {
  const { settings } = useSettings()
  return <output aria-label="probe">{`${settings.key} ${settings.tuning}`}</output>
}

const selected = (name: string) =>
  (screen.getByRole('combobox', { name }) as HTMLSelectElement).selectedOptions[0].textContent

describe('Header', () => {
  it('shows the harp as "C harp · Richter" and edits the tuning setting', () => {
    render(
      <SettingsProvider storage={null}>
        <Header />
        <Probe />
      </SettingsProvider>,
    )
    const harp = screen.getByRole('group', { name: 'Your harp' })
    expect(within(harp).getByRole('combobox', { name: 'Harp key' })).toBeInTheDocument()
    expect(harp).toHaveTextContent('·')
    expect(selected('Harp key')).toBe('C harp')
    expect(selected('Tuning')).toBe('Richter')

    fireEvent.change(screen.getByRole('combobox', { name: 'Tuning' }), {
      target: { value: 'naturalMinor' },
    })
    expect(screen.getByLabelText('probe')).toHaveTextContent('C naturalMinor')
    expect(selected('Tuning')).toBe('Natural minor')
  })

  it('links to the tools and the practice log', () => {
    render(
      <SettingsProvider storage={null}>
        <Header />
      </SettingsProvider>,
    )
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(
      within(nav)
        .getAllByRole('link')
        .map((a) => [a.textContent, a.getAttribute('href')]),
    ).toEqual([
      ['Tuner', '#/tuner'],
      ['Metronome', '#/metronome'],
      ['Log', '#/log'],
    ])
  })
})
