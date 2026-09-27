import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TuningSelector } from './TuningSelector'

describe('TuningSelector', () => {
  it('offers the four tunings by name and reports changes', () => {
    const onChange = vi.fn()
    render(<TuningSelector value="richter" onChange={onChange} />)
    const select = screen.getByRole('combobox', { name: 'Tuning' })
    expect([...select.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
      'Richter',
      'Paddy Richter',
      'Country',
      'Natural minor',
    ])
    fireEvent.change(select, { target: { value: 'country' } })
    expect(onChange).toHaveBeenCalledWith('country')
  })

  it("explains the selected tuning in the select's tooltip", () => {
    render(<TuningSelector value="paddy" onChange={vi.fn()} />)
    expect(screen.getByRole('combobox', { name: 'Tuning' })).toHaveAttribute(
      'title',
      'Hole 3 blow raised a whole step (A on a C harp), for 1st-position melodies.',
    )
  })
})
