import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BendMeter } from './BendMeter'

const LABELS = ['-3 B4', "-3' A#4", "-3'' A4", "-3''' G#4"]

describe('BendMeter', () => {
  it('shows the unbent note on top and one marker per bend step', () => {
    render(<BendMeter labels={LABELS} target={2} depth={null} />)
    const markers = screen.getAllByTestId('bend-marker')
    expect(markers.map((m) => m.textContent)).toEqual(LABELS)
    expect(markers.map((m) => m.style.top)).toEqual(['12.5%', '37.5%', '62.5%', '87.5%'])
    expect(markers[2]).toHaveAttribute('data-target', 'true')
    expect(screen.queryByTestId('bend-dot')).toBeNull()
  })

  it('places the live pitch and clamps it to the meter', () => {
    const { rerender } = render(<BendMeter labels={LABELS} target={2} depth={1} />)
    expect(screen.getByTestId('bend-dot').style.top).toBe('37.5%')
    rerender(<BendMeter labels={LABELS} target={2} depth={-5} />)
    expect(screen.getByTestId('bend-dot').style.top).toBe('0%')
    rerender(<BendMeter labels={LABELS} target={2} depth={10} />)
    expect(screen.getByTestId('bend-dot').style.top).toBe('100%')
  })
})
