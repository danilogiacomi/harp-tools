import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { KeySelector } from './KeySelector'

describe('KeySelector', () => {
  it('offers all 12 keys and reports changes', () => {
    const onChange = vi.fn()
    render(<KeySelector value="C" onChange={onChange} />)
    const select = screen.getByLabelText('Harp key')
    expect(select.querySelectorAll('option')).toHaveLength(12)
    fireEvent.change(select, { target: { value: 'A' } })
    expect(onChange).toHaveBeenCalledWith('A')
  })
})
