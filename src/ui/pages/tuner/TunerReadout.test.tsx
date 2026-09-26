import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TunerReadout } from './TunerReadout'

describe('TunerReadout', () => {
  it('prompts to play when there is no reading', () => {
    render(<TunerReadout reading={null} />)
    expect(screen.getByText(/Play a note/)).toBeInTheDocument()
  })

  it('shows the note, cents, frequency and holes', () => {
    render(
      <TunerReadout
        reading={{ noteLabel: 'A4', cents: 3.2, freq: 440.8, tabs: ["-3''"], onHarp: true }}
      />,
    )
    expect(screen.getByText('A4')).toHaveAttribute('data-quality', 'in-tune')
    expect(screen.getByText('+3¢')).toBeInTheDocument()
    expect(screen.getByText('440.8 Hz')).toBeInTheDocument()
    expect(screen.getByText("-3''")).toBeInTheDocument()
  })

  it('flags pitches that are not on the harp', () => {
    render(
      <TunerReadout
        reading={{ noteLabel: 'B3', cents: -30, freq: 241, tabs: [], onHarp: false }}
      />,
    )
    expect(screen.getByText('Not on this harp')).toBeInTheDocument()
    expect(screen.getByText('B3')).toHaveAttribute('data-quality', 'off')
  })
})
