import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SettingsProvider } from '../settings/SettingsContext'
import { SoundToggle } from './SoundToggle'

describe('SoundToggle', () => {
  it('shows Reed by default and switches the setting to Pure', () => {
    render(
      <SettingsProvider storage={null}>
        <SoundToggle />
      </SettingsProvider>,
    )
    expect(screen.getByRole('group', { name: 'Reference sound' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reed' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Pure' }))
    expect(screen.getByRole('button', { name: 'Pure' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Reed' })).toHaveAttribute('aria-pressed', 'false')
  })
})
