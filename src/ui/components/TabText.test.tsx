import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TabLine, TabText } from './TabText'

describe('TabText', () => {
  it('shows the token as written', () => {
    render(<TabText tab="-3''" />)
    expect(screen.getByText("-3''")).toHaveClass('tab')
  })

  it('lays out a row of tokens in order', () => {
    const { container } = render(<TabLine tabs={['-2', "-3'", '4']} />)
    expect([...container.querySelectorAll('.tab')].map((e) => e.textContent)).toEqual([
      '-2',
      "-3'",
      '4',
    ])
  })
})
